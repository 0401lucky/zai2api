import { describe, expect, it } from "vitest";

import { pickExistingAccountCandidate } from "../worker-src/repository";

describe("repository account merge", () => {
  it("优先按稳定 userId 命中已有账号", () => {
    const match = pickExistingAccountCandidate(
      [
        { id: 1, user_id: "user-a", email: "old@example.com" },
        { id: 2, user_id: null, email: "old@example.com" },
      ],
      "user-a",
      "new@example.com",
    );

    expect(match).toEqual({ id: 1 });
  });

  it("找不到稳定 userId 时允许用 email 升级临时 unknown 账号", () => {
    const match = pickExistingAccountCandidate(
      [
        { id: 7, user_id: "unknown", email: "demo@example.com" },
      ],
      "real-user",
      "demo@example.com",
    );

    expect(match).toEqual({ id: 7 });
  });

  it("不会仅凭 email 合并到已有稳定账号", () => {
    const match = pickExistingAccountCandidate(
      [
        { id: 9, user_id: "stable-user", email: "demo@example.com" },
      ],
      "another-user",
      "demo@example.com",
    );

    expect(match).toBeNull();
  });

  it("当 userId 不稳定时仅匹配临时 email 记录", () => {
    const match = pickExistingAccountCandidate(
      [
        { id: 3, user_id: "unknown", email: "demo@example.com" },
        { id: 4, user_id: "stable-user", email: "demo@example.com" },
      ],
      "unknown",
      "demo@example.com",
    );

    expect(match).toEqual({ id: 3 });
  });
});
