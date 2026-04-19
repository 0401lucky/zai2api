import { describe, expect, it } from "vitest";

import { sanitizeLogDetails } from "../worker-src/repository";

describe("repository log sanitization", () => {
  it("会脱敏敏感字段并保留普通字段", () => {
    const sanitized = sanitizeLogDetails({
      account: "demo@example.com",
      jwt: "jwt-secret",
      session_token: "session-secret",
      nested: {
        authorization: "Bearer secret-token",
        cookie: "session=abc",
      },
      note: "HTTP 401 from /api/v1/auths/",
    });

    expect(sanitized).toEqual({
      account: "demo@example.com",
      jwt: "[已脱敏]",
      session_token: "[已脱敏]",
      nested: {
        authorization: "[已脱敏]",
        cookie: "[已脱敏]",
      },
      note: "HTTP 401 from /api/v1/auths/",
    });
  });

  it("会清洗字符串里的敏感片段", () => {
    const sanitized = sanitizeLogDetails({
      error: "authorization=Bearer abcdef token=12345 enc:v2:abcdef",
    });

    expect(sanitized).toEqual({
      error: "authorization=[已脱敏] token=[已脱敏] enc:v2:[已脱敏]",
    });
  });
});
