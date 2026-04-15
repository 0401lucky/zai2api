import { describe, expect, it } from "vitest";

import { assemblePrompt, buildResponsesOutput, normalizeArgumentString } from "../worker-src/prompt-assembly";

describe("prompt assembly", () => {
  it("把 developer 角色视为 system", () => {
    const prompt = assemblePrompt([
      { role: "developer", content: "You are helpful." },
      { role: "user", content: "Hello" },
    ]);
    expect(prompt).toBe("You are helpful.\n\n<｜User｜>Hello");
  });

  it("保留 tool call 历史和 tool result", () => {
    const prompt = assemblePrompt([
      { role: "user", content: "天气如何？" },
      {
        role: "assistant",
        content: "我去查一下。",
        tool_calls: [
          {
            id: "call_1",
            function: {
              name: "get_weather",
              arguments: '{"city":"beijing"}',
            },
          },
        ],
      },
      {
        role: "tool",
        tool_call_id: "call_1",
        name: "get_weather",
        content: '{"temp":18}',
      },
    ]);
    expect(prompt).toContain("[TOOL_CALL_HISTORY]");
    expect(prompt).toContain("function.name: get_weather");
    expect(prompt).toContain("[TOOL_RESULT_HISTORY]");
  });

  it("保留拼接 json 参数原样", () => {
    expect(normalizeArgumentString(' {"a":1}{"b":2} ')).toBe(' {"a":1}{"b":2} ');
  });

  it("responses output 保持 reasoning 与 answer 分离", () => {
    const output = buildResponsesOutput("final answer", "reasoning text");
    expect(output[0].type).toBe("reasoning");
    expect(output[1].type).toBe("message");
  });
});
