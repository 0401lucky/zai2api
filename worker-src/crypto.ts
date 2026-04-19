import { decodeUtf8, encodeUtf8, fromBase64Url, randomId, toArrayBuffer, toBase64Url } from "./utils";

const HASH_ITERATIONS = 100_000;
const LEGACY_SECRET_PREFIX = "enc:v1:";
const CURRENT_SECRET_PREFIX = "enc:v2:";
const SECRET_KDF_INFO = encodeUtf8("zai2api:account-secret:v2");

async function deriveLegacyAesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(encodeUtf8(secret)));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function deriveAesKey(secret: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey("raw", toArrayBuffer(encodeUtf8(secret)), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      info: toArrayBuffer(SECRET_KDF_INFO),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptSecret(secret: string | null, encryptionSecret: string): Promise<string | null> {
  if (secret === null) {
    return null;
  }
  const salt = new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveAesKey(encryptionSecret, salt);
  const iv = new Uint8Array(crypto.getRandomValues(new Uint8Array(12)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(encodeUtf8(secret)));
  return `${CURRENT_SECRET_PREFIX}${toBase64Url(salt)}.${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptSecret(secret: string | null, encryptionSecret: string): Promise<string | null> {
  if (secret === null) {
    return null;
  }
  if (secret.startsWith(CURRENT_SECRET_PREFIX)) {
    const payload = secret.slice(CURRENT_SECRET_PREFIX.length);
    const [saltPart, ivPart, cipherPart] = payload.split(".", 3);
    if (!saltPart || !ivPart || !cipherPart) {
      throw new Error("密文格式无效");
    }
    const key = await deriveAesKey(encryptionSecret, fromBase64Url(saltPart));
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(fromBase64Url(ivPart)) },
      key,
      toArrayBuffer(fromBase64Url(cipherPart)),
    );
    return decodeUtf8(plaintext);
  }
  if (secret.startsWith(LEGACY_SECRET_PREFIX)) {
    const payload = secret.slice(LEGACY_SECRET_PREFIX.length);
    const [ivPart, cipherPart] = payload.split(".", 2);
    if (!ivPart || !cipherPart) {
      throw new Error("密文格式无效");
    }
    const key = await deriveLegacyAesKey(encryptionSecret);
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(fromBase64Url(ivPart)) },
      key,
      toArrayBuffer(fromBase64Url(cipherPart)),
    );
    return decodeUtf8(plaintext);
  }
  throw new Error("检测到未加密账号密文，请先迁移为 enc:v1 或 enc:v2 格式");
}

async function pbkdf2Digest(password: string, salt: Uint8Array, iterations = HASH_ITERATIONS): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", toArrayBuffer(encodeUtf8(password)), { name: "PBKDF2" }, false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = new Uint8Array(crypto.getRandomValues(new Uint8Array(16)));
  const digest = await pbkdf2Digest(password, salt, HASH_ITERATIONS);
  return `pbkdf2_sha256$${HASH_ITERATIONS}$${toBase64Url(salt)}$${toBase64Url(digest)}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parts = storedHash.split("$", 4);
  if (parts.length !== 4 || parts[0] !== "pbkdf2_sha256") {
    return false;
  }
  const iterations = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iterations)) {
    return false;
  }
  const salt = fromBase64Url(parts[2]);
  const expected = fromBase64Url(parts[3]);
  const actual = await pbkdf2Digest(password, salt, iterations);
  if (actual.length !== expected.length) {
    return false;
  }
  const actualView = new Uint8Array(actual);
  const expectedView = new Uint8Array(expected);
  let result = 0;
  for (let index = 0; index < actualView.length; index += 1) {
    result |= actualView[index] ^ expectedView[index];
  }
  return result === 0;
}

export function timingSafeEqualString(left: string, right: string): boolean {
  const leftBytes = encodeUtf8(left);
  const rightBytes = encodeUtf8(right);
  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  let result = leftBytes.length ^ rightBytes.length;
  for (let index = 0; index < maxLength; index += 1) {
    result |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }
  return result === 0;
}

export function makeSessionId(): string {
  return randomId(32);
}
