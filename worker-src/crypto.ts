import { decodeUtf8, encodeUtf8, fromBase64Url, randomId, toArrayBuffer, toBase64Url } from "./utils";

const HASH_ITERATIONS = 100_000;

async function deriveAesKey(secret: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(encodeUtf8(secret)));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSecret(secret: string | null, encryptionSecret: string): Promise<string | null> {
  if (secret === null) {
    return null;
  }
  const key = await deriveAesKey(encryptionSecret);
  const iv = new Uint8Array(crypto.getRandomValues(new Uint8Array(12)));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv: toArrayBuffer(iv) }, key, toArrayBuffer(encodeUtf8(secret)));
  return `enc:v1:${toBase64Url(iv)}.${toBase64Url(ciphertext)}`;
}

export async function decryptSecret(secret: string | null, encryptionSecret: string): Promise<string | null> {
  if (secret === null) {
    return null;
  }
  if (!secret.startsWith("enc:v1:")) {
    return secret;
  }
  const payload = secret.slice("enc:v1:".length);
  const [ivPart, cipherPart] = payload.split(".", 2);
  if (!ivPart || !cipherPart) {
    throw new Error("密文格式无效");
  }
  const key = await deriveAesKey(encryptionSecret);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64Url(ivPart)) },
    key,
    toArrayBuffer(fromBase64Url(cipherPart)),
  );
  return decodeUtf8(plaintext);
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

export function makeSessionId(): string {
  return randomId(32);
}
