import { describe, expect, it } from "vitest";

import { decryptSecret, encryptSecret, hashPassword, timingSafeEqualString, verifyPassword } from "../worker-src/crypto";
import { encodeUtf8, toArrayBuffer, toBase64Url } from "../worker-src/utils";

async function encryptLegacySecret(secret: string, encryptionSecret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(encodeUtf8(encryptionSecret)));
  const key = await crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt"]);
  const iv = new Uint8Array(crypto.getRandomValues(new Uint8Array(12)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(encodeUtf8(secret)));
  return `enc:v1:${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

describe("crypto helpers", () => {
  it("可以加密并解密账号密文", async () => {
    const secret = "eyJhbGciOi...";
    const encrypted = await encryptSecret(secret, "test-key");
    expect(encrypted).not.toBe(secret);
    expect(encrypted?.startsWith("enc:v2:")).toBe(true);
    await expect(decryptSecret(encrypted, "test-key")).resolves.toBe(secret);
  });

  it("兼容解密旧版 v1 密文", async () => {
    const encrypted = await encryptLegacySecret("legacy-token", "test-key");
    await expect(decryptSecret(encrypted, "test-key")).resolves.toBe("legacy-token");
  });

  it("拒绝明文账号凭证", async () => {
    await expect(decryptSecret("plain-text-token", "test-key")).rejects.toThrow("检测到未加密账号密文");
  });

  it("密码哈希与校验可用", async () => {
    const hashed = await hashPassword("p@ssw0rd");
    await expect(verifyPassword("p@ssw0rd", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hashed)).resolves.toBe(false);
  });

  it("支持等时字符串比较", () => {
    expect(timingSafeEqualString("same-secret", "same-secret")).toBe(true);
    expect(timingSafeEqualString("same-secret", "same-secret-2")).toBe(false);
  });
});
