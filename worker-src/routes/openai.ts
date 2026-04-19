import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import type { UpstreamChunk } from "../bindings";
import type { AppEnv } from "../app-env";
import {
  availableModels,
  chatStreamErrorEvent,
  makeChatCompletionId,
  makeResponseId,
  normalizePublicModelName,
  requestFailureDetail,
  requestFailurePublicMessage,
  requestFailureStatusCode,
  resolveModelRequest,
  responseStreamFailedEvent,
  sseJson,
} from "../helpers";
import { assemblePrompt, assembleResponsesPrompt, buildResponsesOutput } from "../prompt-assembly";
import type { AppServices } from "../services";
import { normalizeUsage, nowSeconds } from "../utils";

const DONE_EVENT = new TextEncoder().encode("data: [DONE]\n\n");
const HEARTBEAT_EVENT = new TextEncoder().encode(": keepalive\n\n");
const UNSUPPORTED_CHAT_PARAMETERS = [
  "temperature",
  "top_p",
  "max_tokens",
  "max_completion_tokens",
  "stop",
  "tools",
  "tool_choice",
  "response_format",
  "n",
  "user",
  "seed",
  "presence_penalty",
  "frequency_penalty",
];

const UNSUPPORTED_RESPONSES_PARAMETERS = [
  "temperature",
  "top_p",
  "max_output_tokens",
  "tools",
  "tool_choice",
  "response_format",
  "parallel_tool_calls",
  "truncation",
  "user",
  "metadata",
];

export function createOpenAIRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/models", async (c) => {
    const services = c.get("services");
    await enforceApiPassword(c.req.raw, services);
    const payload = {
      object: "list",
      data: availableModels(services.config).map((model) => ({
        id: model,
        object: "model",
        created: 0,
        owned_by: "zai2api",
      })),
    };
    await services.repository.addLog({
      level: "info",
      category: "requests",
      message: "已列出可用模型",
      details: { path: c.req.path, model_count: payload.data.length },
    });
    return c.json(payload);
  });

  app.post("/chat/completions", async (c) => {
    const services = c.get("services");
    await enforceApiPassword(c.req.raw, services);
    const startedAt = Date.now();
    const payload = await readJsonBody(c.req.raw);
    assertUnsupportedParameters(payload, UNSUPPORTED_CHAT_PARAMETERS);
    const requestedModel = normalizePublicModelName(String(payload.model ?? services.config.defaultModel));
    const { upstreamModel, enableThinking } = resolveModelRequest(requestedModel);
    const prompt = assemblePrompt(Array.isArray(payload.messages) ? (payload.messages as Record<string, unknown>[]) : []);
    if (!prompt) {
      throw new HTTPException(400, { message: "无法从 messages 组装出有效提示词" });
    }
    if (Boolean(payload.stream)) {
      return streamChatCompletions(services, requestedModel, upstreamModel, prompt, enableThinking);
    }
    try {
      const upstreamResult = await services.accountPool.collectPrompt({
        prompt,
        model: upstreamModel,
        enableThinking,
        autoWebSearch: false,
      });
      await services.repository.addLog({
        level: "info",
        category: "requests",
        message: "聊天补全请求已完成",
        details: {
          path: c.req.path,
          model: requestedModel,
          stream: false,
          enable_thinking: enableThinking,
          prompt_chars: prompt.length,
          answer_chars: upstreamResult.answerText.length,
          reasoning_chars: upstreamResult.reasoningText.length,
          total_tokens: upstreamResult.usage.total_tokens,
          duration_ms: Date.now() - startedAt,
        },
      });
      return c.json({
        id: makeChatCompletionId(),
        object: "chat.completion",
        created: nowSeconds(),
        model: requestedModel,
        choices: [
          {
            index: 0,
            message: {
              role: "assistant",
              content: upstreamResult.answerText,
              reasoning_content: upstreamResult.reasoningText,
            },
            finish_reason: upstreamResult.finishReason,
          },
        ],
        usage: upstreamResult.usage,
      });
    } catch (error) {
      const detail = requestFailureDetail(error);
      await services.repository.addLog({
        level: "warning",
        category: "requests",
        message: "聊天补全请求失败",
        details: {
          path: c.req.path,
          model: requestedModel,
          stream: false,
          enable_thinking: enableThinking,
          error: detail,
          duration_ms: Date.now() - startedAt,
        },
      });
      throw new HTTPException(requestFailureStatusCode(error) as 502 | 503, { message: requestFailurePublicMessage() });
    }
  });

  app.post("/responses", async (c) => {
    const services = c.get("services");
    await enforceApiPassword(c.req.raw, services);
    const startedAt = Date.now();
    const payload = await readJsonBody(c.req.raw);
    assertUnsupportedParameters(payload, UNSUPPORTED_RESPONSES_PARAMETERS);
    const requestedModel = normalizePublicModelName(String(payload.model ?? services.config.defaultModel));
    const { upstreamModel, enableThinking } = resolveModelRequest(requestedModel);
    const prompt = assembleResponsesPrompt(payload);
    if (!prompt) {
      throw new HTTPException(400, { message: "无法从 input 组装出有效提示词" });
    }
    if (Boolean(payload.stream)) {
      return streamResponses(services, requestedModel, upstreamModel, prompt, enableThinking);
    }
    try {
      const upstreamResult = await services.accountPool.collectPrompt({
        prompt,
        model: upstreamModel,
        enableThinking,
        autoWebSearch: false,
      });
      await services.repository.addLog({
        level: "info",
        category: "requests",
        message: "Responses 请求已完成",
        details: {
          path: c.req.path,
          model: requestedModel,
          stream: false,
          enable_thinking: enableThinking,
          prompt_chars: prompt.length,
          answer_chars: upstreamResult.answerText.length,
          reasoning_chars: upstreamResult.reasoningText.length,
          total_tokens: upstreamResult.usage.total_tokens,
          duration_ms: Date.now() - startedAt,
        },
      });
      return c.json({
        id: makeResponseId(),
        object: "response",
        status: "completed",
        model: requestedModel,
        output: buildResponsesOutput(upstreamResult.answerText, upstreamResult.reasoningText),
        usage: {
          input_tokens: upstreamResult.usage.prompt_tokens,
          output_tokens: upstreamResult.usage.completion_tokens,
          total_tokens: upstreamResult.usage.total_tokens,
        },
      });
    } catch (error) {
      const detail = requestFailureDetail(error);
      await services.repository.addLog({
        level: "warning",
        category: "requests",
        message: "Responses 请求失败",
        details: {
          path: c.req.path,
          model: requestedModel,
          stream: false,
          enable_thinking: enableThinking,
          error: detail,
          duration_ms: Date.now() - startedAt,
        },
      });
      throw new HTTPException(requestFailureStatusCode(error) as 502 | 503, { message: requestFailurePublicMessage() });
    }
  });

  return app;
}

async function enforceApiPassword(request: Request, services: AppServices): Promise<void> {
  if (!(await services.auth.isApiAuthEnabled())) {
    return;
  }
  const password = services.auth.extractApiPassword(request);
  if (password && (await services.auth.verifyApiPassword(password))) {
    return;
  }
  await services.repository.addLog({
    level: "warning",
    category: "api_auth",
    message: "API 请求因密码错误被拒绝",
    details: { path: new URL(request.url).pathname },
  });
  throw new HTTPException(401, { message: "API 密码错误" });
}

function streamChatCompletions(
  services: AppServices,
  model: string,
  upstreamModel: string,
  prompt: string,
  enableThinking: boolean,
): Response {
  const completionId = makeChatCompletionId();
  const created = nowSeconds();
  const startedAt = Date.now();
  return new Response(
    new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let finalUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        let answerChars = 0;
        let reasoningChars = 0;
        let firstChunkAt: number | null = null;
        const heartbeat = setInterval(() => controller.enqueue(HEARTBEAT_EVENT), 10_000);

        controller.enqueue(
          sseJson({
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
          }),
        );

        try {
          for await (const chunk of services.accountPool.streamPrompt({
            prompt,
            model: upstreamModel,
            enableThinking,
            autoWebSearch: false,
          })) {
            if (chunk.error) {
              await services.repository.addLog({
                level: "warning",
                category: "requests",
                message: "流式聊天补全请求失败",
                details: {
                  path: "/v1/chat/completions",
                  model,
                  stream: true,
                  enable_thinking: enableThinking,
                  answer_chars: answerChars,
                  reasoning_chars: reasoningChars,
                  error: chunk.error,
                },
              });
              controller.enqueue(chatStreamErrorEvent({ completionId, created, model, message: requestFailurePublicMessage() }));
              clearInterval(heartbeat);
              controller.enqueue(DONE_EVENT);
              controller.close();
              return;
            }
            if (chunk.usage) {
              finalUsage = normalizeUsage(chunk.usage);
            }
            if (!chunk.text) {
              continue;
            }
            const delta = chunk.phase === "thinking" ? { reasoning_content: chunk.text } : { content: chunk.text };
            if (chunk.phase === "thinking") {
              reasoningChars += chunk.text.length;
            } else {
              answerChars += chunk.text.length;
            }
            if (firstChunkAt === null) {
              firstChunkAt = Date.now();
            }
            controller.enqueue(
              sseJson({
                id: completionId,
                object: "chat.completion.chunk",
                created,
                model,
                choices: [{ index: 0, delta, finish_reason: null }],
              }),
            );
          }
        } catch (error) {
          const detail = requestFailureDetail(error);
          await services.repository.addLog({
            level: "warning",
            category: "requests",
            message: "流式聊天补全请求失败",
            details: {
              path: "/v1/chat/completions",
              model,
              stream: true,
              enable_thinking: enableThinking,
              answer_chars: answerChars,
              reasoning_chars: reasoningChars,
              error: detail,
              duration_ms: Date.now() - startedAt,
            },
          });
          controller.enqueue(chatStreamErrorEvent({ completionId, created, model, message: requestFailurePublicMessage() }));
          clearInterval(heartbeat);
          controller.enqueue(DONE_EVENT);
          controller.close();
          return;
        }

        await services.repository.addLog({
          level: "info",
          category: "requests",
          message: "流式聊天补全请求已完成",
          details: {
            path: "/v1/chat/completions",
            model,
            stream: true,
            enable_thinking: enableThinking,
            prompt_chars: prompt.length,
            answer_chars: answerChars,
            reasoning_chars: reasoningChars,
            total_tokens: finalUsage.total_tokens,
            first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
            duration_ms: Date.now() - startedAt,
          },
        });
        controller.enqueue(
          sseJson({
            id: completionId,
            object: "chat.completion.chunk",
            created,
            model,
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: finalUsage,
          }),
        );
        clearInterval(heartbeat);
        controller.enqueue(DONE_EVENT);
        controller.close();
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    },
  );
}

function streamResponses(
  services: AppServices,
  model: string,
  upstreamModel: string,
  prompt: string,
  enableThinking: boolean,
): Response {
  const responseId = makeResponseId();
  const created = nowSeconds();
  const startedAt = Date.now();
  const reasoningItemId = `rs_${crypto.randomUUID().replace(/-/g, "")}`;
  const messageItemId = `msg_${crypto.randomUUID().replace(/-/g, "")}`;
  return new Response(
    new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let finalUsage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
        let reasoningStarted = false;
        let messageStarted = false;
        let firstChunkAt = null;
        const reasoningParts: string[] = [];
        const answerParts: string[] = [];
        const heartbeat = setInterval(() => controller.enqueue(HEARTBEAT_EVENT), 10_000);

        controller.enqueue(sseJson({ type: "response.created", response: { id: responseId, object: "response", created, model, status: "in_progress" } }));
        controller.enqueue(sseJson({ type: "response.in_progress", response: { id: responseId, object: "response", created, model, status: "in_progress" } }));

        try {
          for await (const chunk of services.accountPool.streamPrompt({
            prompt,
            model: upstreamModel,
            enableThinking,
            autoWebSearch: false,
          })) {
            if (chunk.error) {
              await services.repository.addLog({
                level: "warning",
                category: "requests",
                message: "流式 Responses 请求失败",
                details: {
                  path: "/v1/responses",
                  model,
                  stream: true,
                  enable_thinking: enableThinking,
                  answer_chars: answerParts.join("").length,
                  reasoning_chars: reasoningParts.join("").length,
                  error: chunk.error,
                },
              });
              controller.enqueue(responseStreamFailedEvent({ responseId, created, model, message: requestFailurePublicMessage() }));
              clearInterval(heartbeat);
              controller.enqueue(DONE_EVENT);
              controller.close();
              return;
            }
            if (chunk.usage) {
              const usage = normalizeUsage(chunk.usage);
              finalUsage = {
                input_tokens: usage.prompt_tokens,
                output_tokens: usage.completion_tokens,
                total_tokens: usage.total_tokens,
              };
            }
            if (!chunk.text) {
              continue;
            }
            if (chunk.phase === "thinking") {
              reasoningParts.push(chunk.text);
              if (!reasoningStarted) {
                reasoningStarted = true;
                controller.enqueue(sseJson({ type: "response.output_item.added", output_index: 0, item: { id: reasoningItemId, type: "reasoning", summary: [] } }));
              }
              continue;
            }
            answerParts.push(chunk.text);
            if (firstChunkAt === null) {
              firstChunkAt = Date.now();
            }
            const outputIndex = reasoningStarted ? 1 : 0;
            if (!messageStarted) {
              messageStarted = true;
              controller.enqueue(sseJson({ type: "response.output_item.added", output_index: outputIndex, item: { id: messageItemId, type: "message", role: "assistant", status: "in_progress", content: [] } }));
              controller.enqueue(sseJson({ type: "response.content_part.added", item_id: messageItemId, output_index: outputIndex, content_index: 0, part: { type: "output_text", text: "", annotations: [] } }));
            }
            controller.enqueue(sseJson({ type: "response.output_text.delta", item_id: messageItemId, output_index: outputIndex, content_index: 0, delta: chunk.text }));
          }
        } catch (error) {
          const detail = requestFailureDetail(error);
          await services.repository.addLog({
            level: "warning",
            category: "requests",
            message: "流式 Responses 请求失败",
            details: {
              path: "/v1/responses",
              model,
              stream: true,
              enable_thinking: enableThinking,
              answer_chars: answerParts.join("").length,
              reasoning_chars: reasoningParts.join("").length,
              error: detail,
              duration_ms: Date.now() - startedAt,
            },
          });
          controller.enqueue(responseStreamFailedEvent({ responseId, created, model, message: requestFailurePublicMessage() }));
          clearInterval(heartbeat);
          controller.enqueue(DONE_EVENT);
          controller.close();
          return;
        }

        if (reasoningStarted) {
          controller.enqueue(sseJson({ type: "response.output_item.done", output_index: 0, item: { id: reasoningItemId, type: "reasoning", summary: [{ type: "summary_text", text: reasoningParts.join("") }] } }));
        }

        const outputIndex = reasoningStarted ? 1 : 0;
        if (!messageStarted) {
          messageStarted = true;
          controller.enqueue(sseJson({ type: "response.output_item.added", output_index: outputIndex, item: { id: messageItemId, type: "message", role: "assistant", status: "in_progress", content: [] } }));
          controller.enqueue(sseJson({ type: "response.content_part.added", item_id: messageItemId, output_index: outputIndex, content_index: 0, part: { type: "output_text", text: "", annotations: [] } }));
        }

        const finalAnswer = answerParts.join("");
        controller.enqueue(sseJson({ type: "response.output_text.done", item_id: messageItemId, output_index: outputIndex, content_index: 0, text: finalAnswer }));
        controller.enqueue(sseJson({ type: "response.content_part.done", item_id: messageItemId, output_index: outputIndex, content_index: 0, part: { type: "output_text", text: finalAnswer, annotations: [] } }));
        controller.enqueue(
          sseJson({
            type: "response.output_item.done",
            output_index: outputIndex,
            item: {
              id: messageItemId,
              type: "message",
              role: "assistant",
              status: "completed",
              content: [{ type: "output_text", text: finalAnswer, annotations: [] }],
            },
          }),
        );

        const completed = {
          id: responseId,
          object: "response",
          status: "completed",
          model,
          output: buildResponsesOutput(finalAnswer, reasoningParts.join("")),
          usage: finalUsage,
        };
        await services.repository.addLog({
          level: "info",
          category: "requests",
          message: "流式 Responses 请求已完成",
          details: {
            path: "/v1/responses",
            model,
            stream: true,
            enable_thinking: enableThinking,
            prompt_chars: prompt.length,
            answer_chars: finalAnswer.length,
            reasoning_chars: reasoningParts.join("").length,
            total_tokens: finalUsage.total_tokens,
            first_chunk_ms: firstChunkAt === null ? null : firstChunkAt - startedAt,
            duration_ms: Date.now() - startedAt,
          },
        });
        controller.enqueue(sseJson({ type: "response.completed", response: completed }));
        clearInterval(heartbeat);
        controller.enqueue(DONE_EVENT);
        controller.close();
      },
    }),
    {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    },
  );
}

async function readJsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    throw new HTTPException(400, { message: "请求体必须是有效 JSON" });
  }
}

function assertUnsupportedParameters(payload: Record<string, unknown>, keys: string[]): void {
  const provided = keys.filter((key) => Object.prototype.hasOwnProperty.call(payload, key) && payload[key] !== null);
  if (!provided.length) {
    return;
  }
  throw new HTTPException(400, { message: `当前代理暂不支持这些参数：${provided.join(", ")}` });
}
