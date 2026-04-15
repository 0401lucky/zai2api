const TEXT_BLOCK_TYPES = new Set(["text", "input_text", "output_text"]);
const IMAGE_MARKDOWN_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

interface PromptMessage {
  role: string;
  content: string;
}

export function assemblePrompt(messages: Iterable<Record<string, unknown>>): string {
  const normalized = normalizeMessages(messages);
  const merged = mergeAdjacentSameRole(normalized);
  return renderPrompt(merged);
}

export function assembleResponsesPrompt(payload: Record<string, unknown>): string {
  if (typeof payload.input === "string") {
    return assemblePrompt([{ role: "user", content: payload.input }]);
  }
  if (Array.isArray(payload.input)) {
    if (payload.input.every((item) => item && typeof item === "object" && "role" in item)) {
      return assemblePrompt(payload.input as Record<string, unknown>[]);
    }
    return assemblePrompt([{ role: "user", content: normalizeInputBlocks(payload.input) }]);
  }
  if (Array.isArray(payload.messages)) {
    return assemblePrompt(payload.messages as Record<string, unknown>[]);
  }
  return "";
}

export function buildResponsesOutput(answerText: string, reasoningText: string): Array<Record<string, unknown>> {
  const output: Array<Record<string, unknown>> = [];
  if (reasoningText) {
    output.push({
      id: `rs_${crypto.randomUUID().replace(/-/g, "")}`,
      type: "reasoning",
      summary: [{ type: "summary_text", text: reasoningText }],
    });
  }
  output.push({
    id: `msg_${crypto.randomUUID().replace(/-/g, "")}`,
    type: "message",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text: answerText, annotations: [] }],
  });
  return output;
}

export function normalizeArgumentString(value: unknown): string {
  if (value === null || value === undefined) {
    return "{}";
  }
  if (typeof value === "string") {
    const stripped = value.trim();
    if (!stripped) {
      return "{}";
    }
    if (stripped.startsWith("{") && stripped.endsWith("}") && stripped.includes("}{")) {
      return value;
    }
    return stripped;
  }
  if (typeof value === "object" || typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  return String(value);
}

function normalizeMessages(messages: Iterable<Record<string, unknown>>): PromptMessage[] {
  const normalized: PromptMessage[] = [];
  let toolCallFallbackIndex = 1;

  for (const message of messages) {
    const role = normalizeRole(message.role);
    const textContent = normalizeMarkdownImages(extractTextContent(message.content));

    if (role === "assistant") {
      const parts: string[] = [];
      if (textContent) {
        parts.push(textContent);
      }
      for (const toolCall of iterAssistantToolCalls(message)) {
        parts.push(formatToolCallHistory(toolCall, toolCallFallbackIndex));
        toolCallFallbackIndex += 1;
      }
      if (parts.length) {
        normalized.push({ role: "assistant", content: parts.join("\n\n") });
      }
      continue;
    }

    if (role === "tool" || role === "function") {
      normalized.push({ role: "user", content: formatToolResultHistory(message, textContent) });
      continue;
    }

    if (textContent) {
      normalized.push({ role, content: textContent });
    }
  }

  return normalized;
}

function mergeAdjacentSameRole(messages: PromptMessage[]): PromptMessage[] {
  const merged: PromptMessage[] = [];
  for (const message of messages) {
    const current = merged[merged.length - 1];
    if (current && current.role === message.role) {
      current.content = `${current.content}\n\n${message.content}`;
      continue;
    }
    merged.push({ ...message });
  }
  return merged;
}

function renderPrompt(messages: PromptMessage[]): string {
  const rendered: string[] = [];
  let firstNonAssistant = true;
  for (const message of messages) {
    if (message.role === "assistant") {
      rendered.push(`<｜Assistant｜>${message.content}<｜end▁of▁sentence｜>`);
      continue;
    }
    if (firstNonAssistant) {
      rendered.push(message.content);
      firstNonAssistant = false;
      continue;
    }
    rendered.push(`<｜User｜>${message.content}`);
  }
  return rendered.filter(Boolean).join("\n\n").trim();
}

function normalizeRole(role: unknown): string {
  const roleString = String(role ?? "user").trim().toLowerCase();
  if (roleString === "developer") {
    return "system";
  }
  if (["system", "user", "assistant", "tool", "function"].includes(roleString)) {
    return roleString;
  }
  return "user";
}

function extractTextContent(content: unknown): string {
  if (content === null || content === undefined) {
    return "";
  }
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (!block || typeof block !== "object") {
        continue;
      }
      const item = block as Record<string, unknown>;
      if (!TEXT_BLOCK_TYPES.has(String(item.type ?? ""))) {
        continue;
      }
      const value = item.text ?? item.content;
      if (value !== undefined && value !== null) {
        parts.push(String(value));
      }
    }
    return parts.join("\n");
  }
  return String(content);
}

function iterAssistantToolCalls(message: Record<string, unknown>): Record<string, unknown>[] {
  if (Array.isArray(message.tool_calls)) {
    return message.tool_calls.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  }
  if (message.function_call && typeof message.function_call === "object") {
    return [{ id: message.id, type: "function", function: message.function_call as Record<string, unknown> }];
  }
  return [];
}

function formatToolCallHistory(toolCall: Record<string, unknown>, fallbackIndex: number): string {
  const fn = toolCall.function && typeof toolCall.function === "object" ? (toolCall.function as Record<string, unknown>) : {};
  const toolCallId = String(toolCall.id ?? `call_${fallbackIndex}`);
  const name = String(fn.name ?? toolCall.name ?? "unknown");
  const rawArguments = fn.arguments ?? toolCall.arguments ?? toolCall.input;
  const argumentsText = normalizeArgumentString(rawArguments);
  return [
    "[TOOL_CALL_HISTORY]",
    "status: already_called",
    "origin: assistant",
    "not_user_input: true",
    `tool_call_id: ${toolCallId}`,
    `function.name: ${name}`,
    `function.arguments: ${argumentsText}`,
    "[/TOOL_CALL_HISTORY]",
  ].join("\n");
}

function formatToolResultHistory(message: Record<string, unknown>, textContent: string): string {
  const toolCallId = String(message.tool_call_id ?? message.id ?? "unknown");
  const name = String(message.name ?? message.tool_name ?? "unknown");
  const content = textContent || "null";
  return [
    "[TOOL_RESULT_HISTORY]",
    "status: already_returned",
    "origin: tool_runtime",
    "not_user_input: true",
    `tool_call_id: ${toolCallId}`,
    `name: ${name}`,
    `content: ${content}`,
    "[/TOOL_RESULT_HISTORY]",
  ].join("\n");
}

function normalizeInputBlocks(items: unknown[]): string {
  const parts: string[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object") {
      parts.push(String(item));
      continue;
    }
    const block = item as Record<string, unknown>;
    if (["input_text", "text", "output_text"].includes(String(block.type ?? ""))) {
      const value = block.text ?? block.content;
      if (value !== undefined && value !== null) {
        parts.push(String(value));
      }
    }
  }
  return parts.join("\n");
}

function normalizeMarkdownImages(text: string): string {
  return text.replace(IMAGE_MARKDOWN_RE, "[$1]($2)");
}
