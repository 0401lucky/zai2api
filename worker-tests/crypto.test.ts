import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, hashPassword, verifyPassword } from "../worker-src/crypto";

describe("crypto helpers", () => {
  it("可以加密并解密账号密文", async () => {
    const secret = "eyJhbGciOi...";
    const encrypted = await encryptSecret(secret, "test-key");
    expect(encrypted).not.toBe(secret);
    await expect(decryptSecret(encrypted, "test-key")).resolves.toBe(secret);
  });

  it("密码哈希与校验可用", async () => {
    const hashed = await hashPassword("p@ssw0rd");
    await expect(verifyPassword("p@ssw0rd", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hashed)).resolves.toBe(false);
  });
});
