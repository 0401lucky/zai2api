const encoder = new TextEncoder();
const decoder = new TextDecoder();
type BinaryLike = ArrayBuffer | ArrayBufferView;

export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function encodeUtf8(value: string): Uint8Array {
  return new Uint8Array(encoder.encode(value));
}

export function decodeUtf8(value: BinaryLike): string {
  return decoder.decode(value);
}

export function toUint8Array(value: BinaryLike): Uint8Array {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    const buffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer;
    return new Uint8Array(buffer);
  }
  return new Uint8Array(value.slice(0) as ArrayBuffer);
}

export function toArrayBuffer(value: BinaryLike): ArrayBuffer {
  const bytes = toUint8Array(value);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function randomId(bytes = 16): string {
  const value = new Uint8Array(bytes);
  crypto.getRandomValues(value);
  return toBase64Url(value);
}

export function toBase64Url(value: BinaryLike): string {
  const bytes = toUint8Array(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4 || 4)) % 4);
  const binary = atob(padded);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function toBase64(value: string): string {
  return btoa(unescape(encodeURIComponent(value)));
}

export function toHex(bytes: BinaryLike): string {
  return Array.from(toUint8Array(bytes))
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");
}

export function maskSecret(secret: string | null, prefix = 6, suffix = 4): string | null {
  if (secret === null) {
    return null;
  }
  if (secret.length <= prefix + suffix) {
    return "*".repeat(secret.length);
  }
  return `${secret.slice(0, prefix)}***${secret.slice(-suffix)}`;
}

export function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes", "on"].includes(value.toLowerCase());
}

export function parseInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) {
    return null;
  }
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function normalizeUsage(usage: unknown): { prompt_tokens: number; completion_tokens: number; total_tokens: number } {
  if (!usage || typeof usage !== "object") {
    return { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  }
  const input = usage as Record<string, unknown>;
  const promptTokens = Number(input.prompt_tokens ?? input.input_tokens ?? 0) || 0;
  const completionTokens = Number(input.completion_tokens ?? input.output_tokens ?? 0) || 0;
  const totalTokens = Number(input.total_tokens ?? promptTokens + completionTokens) || 0;
  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}
