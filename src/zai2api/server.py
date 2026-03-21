from __future__ import annotations

import json
import time
import uuid
from contextlib import asynccontextmanager
from typing import Any, AsyncIterator

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse

from .config import settings
from .prompt_assembly import assemble_prompt
from .zai_client import ZAIClient, normalize_usage


def create_app() -> FastAPI:
    client = ZAIClient(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        completion_version = await client.verify_completion_version()
        if completion_version != 2:
            raise RuntimeError(f"Unsupported Z.ai completion_version={completion_version}")
        yield
        await client.aclose()

    app = FastAPI(title="zai2api", lifespan=lifespan)

    @app.get("/healthz")
    async def healthz() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/v1/chat/completions")
    async def chat_completions(request: Request):
        payload = await request.json()
        model = payload.get("model") or settings.default_model
        messages = payload.get("messages") or []
        stream = bool(payload.get("stream"))
        prompt = assemble_prompt(messages)
        if not prompt:
            raise HTTPException(status_code=400, detail="No prompt could be assembled from messages")

        if stream:
            return StreamingResponse(
                stream_chat_completions(client=client, model=model, prompt=prompt),
                media_type="text/event-stream",
            )

        upstream = await client.collect_prompt(
            prompt=prompt,
            model=model,
            enable_thinking=True,
            auto_web_search=False,
        )
        usage = upstream.usage
        response = {
            "id": make_chat_completion_id(),
            "object": "chat.completion",
            "created": int(time.time()),
            "model": model,
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": upstream.answer_text,
                        "reasoning_content": upstream.reasoning_text,
                    },
                    "finish_reason": upstream.finish_reason,
                }
            ],
            "usage": usage,
        }
        return JSONResponse(response)

    @app.post("/v1/responses")
    async def responses_api(request: Request):
        payload = await request.json()
        model = payload.get("model") or settings.default_model
        stream = bool(payload.get("stream"))
        prompt = assemble_responses_prompt(payload)
        if not prompt:
            raise HTTPException(status_code=400, detail="No prompt could be assembled from input")

        if stream:
            return StreamingResponse(
                stream_responses(client=client, model=model, prompt=prompt),
                media_type="text/event-stream",
            )

        upstream = await client.collect_prompt(
            prompt=prompt,
            model=model,
            enable_thinking=True,
            auto_web_search=False,
        )
        response = {
            "id": make_response_id(),
            "object": "response",
            "status": "completed",
            "model": model,
            "output": build_responses_output(
                answer_text=upstream.answer_text,
                reasoning_text=upstream.reasoning_text,
            ),
            "usage": {
                "input_tokens": upstream.usage["prompt_tokens"],
                "output_tokens": upstream.usage["completion_tokens"],
                "total_tokens": upstream.usage["total_tokens"],
            },
        }
        return JSONResponse(response)

    @app.get("/")
    async def root() -> PlainTextResponse:
        return PlainTextResponse("zai2api is running")

    return app


async def stream_chat_completions(*, client: ZAIClient, model: str, prompt: str) -> AsyncIterator[bytes]:
    completion_id = make_chat_completion_id()
    created = int(time.time())
    answer_parts: list[str] = []
    reasoning_parts: list[str] = []
    final_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    yield sse_json(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {"role": "assistant"}, "finish_reason": None}],
        }
    )

    async for chunk in client.stream_prompt(
        prompt=prompt,
        model=model,
        enable_thinking=True,
        auto_web_search=False,
    ):
        if chunk.error:
            raise HTTPException(status_code=502, detail=chunk.error)
        if chunk.usage:
            final_usage = normalize_usage(chunk.usage)
        if not chunk.text:
            continue

        if chunk.phase == "thinking":
            reasoning_parts.append(chunk.text)
            delta = {"reasoning_content": chunk.text}
        else:
            answer_parts.append(chunk.text)
            delta = {"content": chunk.text}

        yield sse_json(
            {
                "id": completion_id,
                "object": "chat.completion.chunk",
                "created": created,
                "model": model,
                "choices": [{"index": 0, "delta": delta, "finish_reason": None}],
            }
        )

    yield sse_json(
        {
            "id": completion_id,
            "object": "chat.completion.chunk",
            "created": created,
            "model": model,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            "usage": final_usage,
        }
    )
    yield b"data: [DONE]\n\n"


async def stream_responses(*, client: ZAIClient, model: str, prompt: str) -> AsyncIterator[bytes]:
    response_id = make_response_id()
    created = int(time.time())
    reasoning_item_id = f"rs_{uuid.uuid4().hex}"
    message_item_id = f"msg_{uuid.uuid4().hex}"
    final_usage = {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0}
    reasoning_started = False
    message_started = False
    reasoning_parts: list[str] = []
    answer_parts: list[str] = []

    yield sse_json({"type": "response.created", "response": {"id": response_id, "object": "response", "created": created, "model": model, "status": "in_progress"}})
    yield sse_json({"type": "response.in_progress", "response": {"id": response_id, "object": "response", "created": created, "model": model, "status": "in_progress"}})

    async for chunk in client.stream_prompt(
        prompt=prompt,
        model=model,
        enable_thinking=True,
        auto_web_search=False,
    ):
        if chunk.error:
            raise HTTPException(status_code=502, detail=chunk.error)
        if chunk.usage:
            usage = normalize_usage(chunk.usage)
            final_usage = {
                "input_tokens": usage["prompt_tokens"],
                "output_tokens": usage["completion_tokens"],
                "total_tokens": usage["total_tokens"],
            }
        if not chunk.text:
            continue

        if chunk.phase == "thinking":
            reasoning_parts.append(chunk.text)
            if not reasoning_started:
                reasoning_started = True
                yield sse_json({"type": "response.output_item.added", "output_index": 0, "item": {"id": reasoning_item_id, "type": "reasoning", "summary": []}})
            continue

        answer_parts.append(chunk.text)
        if not message_started:
            message_started = True
            message_item = {
                "id": message_item_id,
                "type": "message",
                "role": "assistant",
                "status": "in_progress",
                "content": [],
            }
            yield sse_json({"type": "response.output_item.added", "output_index": 1 if reasoning_started else 0, "item": message_item})
            yield sse_json({"type": "response.content_part.added", "item_id": message_item_id, "output_index": 1 if reasoning_started else 0, "content_index": 0, "part": {"type": "output_text", "text": "", "annotations": []}})
        yield sse_json({"type": "response.output_text.delta", "item_id": message_item_id, "output_index": 1 if reasoning_started else 0, "content_index": 0, "delta": chunk.text})

    if reasoning_started:
        yield sse_json({"type": "response.output_item.done", "output_index": 0, "item": {"id": reasoning_item_id, "type": "reasoning", "summary": [{"type": "summary_text", "text": "".join(reasoning_parts)}]}})

    if not message_started:
        message_started = True
        empty_message = {
            "id": message_item_id,
            "type": "message",
            "role": "assistant",
            "status": "in_progress",
            "content": [],
        }
        yield sse_json({"type": "response.output_item.added", "output_index": 1 if reasoning_started else 0, "item": empty_message})
        yield sse_json({"type": "response.content_part.added", "item_id": message_item_id, "output_index": 1 if reasoning_started else 0, "content_index": 0, "part": {"type": "output_text", "text": "", "annotations": []}})

    final_answer = "".join(answer_parts)
    yield sse_json({"type": "response.output_text.done", "item_id": message_item_id, "output_index": 1 if reasoning_started else 0, "content_index": 0, "text": final_answer})
    yield sse_json({"type": "response.content_part.done", "item_id": message_item_id, "output_index": 1 if reasoning_started else 0, "content_index": 0, "part": {"type": "output_text", "text": final_answer, "annotations": []}})
    yield sse_json({"type": "response.output_item.done", "output_index": 1 if reasoning_started else 0, "item": {"id": message_item_id, "type": "message", "role": "assistant", "status": "completed", "content": [{"type": "output_text", "text": final_answer, "annotations": []}]}})

    completed = {
        "id": response_id,
        "object": "response",
        "status": "completed",
        "model": model,
        "output": build_responses_output(final_answer, "".join(reasoning_parts)),
        "usage": final_usage,
    }
    yield sse_json({"type": "response.completed", "response": completed})
    yield b"data: [DONE]\n\n"


def assemble_responses_prompt(payload: dict[str, Any]) -> str:
    if isinstance(payload.get("input"), str):
        return assemble_prompt([{"role": "user", "content": payload["input"]}])

    if isinstance(payload.get("input"), list):
        input_payload = payload["input"]
        if all(isinstance(item, dict) and "role" in item for item in input_payload):
            return assemble_prompt(input_payload)
        return assemble_prompt([{"role": "user", "content": normalize_input_blocks(input_payload)}])

    if isinstance(payload.get("messages"), list):
        return assemble_prompt(payload["messages"])

    return ""


def normalize_input_blocks(items: list[Any]) -> str:
    parts: list[str] = []
    for item in items:
        if not isinstance(item, dict):
            parts.append(str(item))
            continue
        if item.get("type") in {"input_text", "text", "output_text"}:
            value = item.get("text") or item.get("content")
            if value:
                parts.append(str(value))
    return "\n".join(parts)


def build_responses_output(answer_text: str, reasoning_text: str) -> list[dict[str, Any]]:
    output: list[dict[str, Any]] = []
    if reasoning_text:
        output.append(
            {
                "id": f"rs_{uuid.uuid4().hex}",
                "type": "reasoning",
                "summary": [{"type": "summary_text", "text": reasoning_text}],
            }
        )
    output.append(
        {
            "id": f"msg_{uuid.uuid4().hex}",
            "type": "message",
            "role": "assistant",
            "status": "completed",
            "content": [{"type": "output_text", "text": answer_text, "annotations": []}],
        }
    )
    return output


def sse_json(payload: dict[str, Any]) -> bytes:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode()


def make_chat_completion_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex}"


def make_response_id() -> str:
    return f"resp_{uuid.uuid4().hex}"
