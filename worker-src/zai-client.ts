import type { SessionState, TokenUsage, UpstreamChunk, UpstreamResult } from "./bindings";
import type { AppConfig } from "./config";
import { encodeUtf8, fromBase64Url, normalizeUsage, toArrayBuffer, toBase64, toHex } from "./utils";

const FE_VERSION = "prod-fe-1.0.272";
const SIGNING_SECRET = "key-@@@@)))()((9))-xxxx&&&%%%%%";
const USER_AGENT = "Mozilla/5.0";
const SESSION_CACHE_TTL_MS = 10 * 60 * 1000;

interface CachedSessionEntry {
  session: SessionState;
  expiresAt: number;
}

const sessionCache = new Map<string, CachedSessionEntry>();

export class UpstreamHttpError extends Error {
  constructor(
    message: string,
    readonly method: string,
    readonly path: string,
    readonly statusCode: number,
    readonly responseText: string,
  ) {
    super(message);
    this.name = "UpstreamHttpError";
  }
}

export class UpstreamRequestError extends Error {
  constructor(message: string, readonly operation: string) {
    super(message);
    this.name = "UpstreamRequestError";
  }
}

async function hmacHex(key: string, data: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(encodeUtf8(key)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, toArrayBuffer(encodeUtf8(data)));
  return toHex(signature);
}

function formatFixedOffsetLocalTime(date: Date, offsetMinutes: number): string {
  const shifted = new Date(date.getTime() + offsetMinutes * 60 * 1000);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const hours = String(Math.floor(abs / 60)).padStart(2, "0");
  const minutes = String(abs % 60).padStart(2, "0");
  return `${weekdays[shifted.getUTCDay()]} ${months[shifted.getUTCMonth()]} ${String(shifted.getUTCDate()).padStart(2, "0")} ${shifted.getUTCFullYear()} ${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}:${String(shifted.getUTCSeconds()).padStart(2, "0")} GMT${sign}${hours}${minutes}`;
}

function formatUtcTime(date: Date): string {
  return date.toUTCString().replace("GMT", "GMT");
}

async function fetchWithTimeout(request: Request, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error) {
      throw new UpstreamRequestError(error.message, `${request.method} ${new URL(request.url).pathname}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function ensureOk(response: Response, method: string, path: string): Promise<Response> {
  if (response.ok) {
    return response;
  }
  const text = await response.text();
  throw new UpstreamHttpError(
    `上游接口错误: ${method} ${path} -> HTTP ${response.status}`,
    method,
    path,
    response.status,
    text,
  );
}

async function requestWithConfig(
  config: AppConfig,
  method: string,
  path: string,
  init: { headers?: Record<string, string>; body?: BodyInit | null },
): Promise<Response> {
  const headers = new Headers({
    "User-Agent": USER_AGENT,
    "X-FE-Version": FE_VERSION,
    "Accept-Language": "en-US",
    ...init.headers,
  });
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const url = new URL(path, config.zaiBaseUrl);
  const response = await fetchWithTimeout(new Request(url.toString(), { method, headers, body: init.body }), config.requestTimeoutMs);
  return ensureOk(response, method, new URL(url.toString()).pathname);
}

async function* iterateLines(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        buffer += decoder.decode();
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex !== -1) {
        const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
        buffer = buffer.slice(newlineIndex + 1);
        yield line;
        newlineIndex = buffer.indexOf("\n");
      }
    }
    if (buffer) {
      yield buffer.replace(/\r$/, "");
    }
  } finally {
    reader.releaseLock();
  }
}

export function describeHttpError(error: unknown): string {
  if (error instanceof UpstreamHttpError) {
    return `上游接口错误: ${error.method} ${error.path} -> HTTP ${error.statusCode}`;
  }
  if (error instanceof UpstreamRequestError) {
    return `上游请求失败: ${error.operation}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export async function requestGuestSession(config: AppConfig): Promise<SessionState> {
  const response = await requestWithConfig(config, "GET", "/api/v1/auths/", {});
  const payload = await response.json<Record<string, unknown>>();
  return {
    token: String(payload.token),
    userId: String(payload.id),
    name: String(payload.name ?? ""),
    email: String(payload.email ?? ""),
    role: String(payload.role ?? "user"),
  };
}

export class ZAIClient {
  private session: SessionState | null = null;
  private sessionValidated = false;
  private readonly cacheKey: string | null;

  constructor(
    private readonly config: AppConfig,
    private readonly zaiJwt: string | null = config.zaiJwt,
    private readonly zaiSessionToken: string | null = config.zaiSessionToken,
  ) {
    this.cacheKey = this.zaiJwt ? `jwt:${this.zaiJwt}` : this.zaiSessionToken ? `session:${this.zaiSessionToken}` : null;
    if (this.zaiSessionToken) {
      this.session = this.sessionFromToken(this.zaiSessionToken);
    }
  }

  async ensureSession(forceRefresh = false): Promise<SessionState> {
    if (!forceRefresh) {
      const cached = this.readCachedSession();
      if (cached) {
        this.session = cached;
        this.sessionValidated = true;
        return cached;
      }
    }

    if (this.session && !forceRefresh && (this.zaiJwt || this.sessionValidated)) {
      return this.session;
    }

    if (this.zaiJwt) {
      this.session = await this.exchangeToken(this.zaiJwt);
      this.sessionValidated = true;
      this.writeCachedSession(this.session);
      return this.session;
    }

    if (this.zaiSessionToken) {
      const token = this.session?.token ?? this.zaiSessionToken;
      this.session = await this.exchangeToken(token);
      this.sessionValidated = true;
      this.writeCachedSession(this.session);
      return this.session;
    }

    throw new Error("缺少 ZAI_JWT 或 ZAI_SESSION_TOKEN");
  }

  async verifyCompletionVersion(): Promise<number> {
    const session = await this.ensureSession();
    const response = await this.request("GET", "/api/config", {
      headers: { Authorization: `Bearer ${session.token}` },
    });
    const payload = await response.json<Record<string, unknown>>();
    return Number(payload.completion_version ?? 1);
  }

  async createChat(input: {
    session: SessionState;
    model: string;
    prompt: string;
    enableThinking: boolean;
    autoWebSearch: boolean;
  }): Promise<{ recordId: string; userMessageId: string }> {
    const userMessageId = crypto.randomUUID();
    const chat = {
      id: "",
      title: "New Chat",
      models: [input.model],
      history: {
        currentId: userMessageId,
        messages: {
          [userMessageId]: {
            id: userMessageId,
            parentId: null,
            childrenIds: [],
            role: "user",
            content: input.prompt,
            timestamp: Math.floor(Date.now() / 1000),
            models: [input.model],
          },
        },
      },
      tags: [],
      flags: [],
      features: [],
      mcp_servers: [],
      enable_thinking: input.enableThinking,
      auto_web_search: input.autoWebSearch,
      message_version: 1,
      timestamp: Date.now(),
    };
    const response = await this.request("POST", "/api/v1/chats/new", {
      headers: { Authorization: `Bearer ${input.session.token}` },
      body: JSON.stringify({ chat }),
    });
    const payload = await response.json<Record<string, unknown>>();
    return {
      recordId: String(payload.id),
      userMessageId,
    };
  }

  async *streamPrompt(input: {
    prompt: string;
    model: string;
    enableThinking: boolean;
    autoWebSearch: boolean;
  }): AsyncGenerator<UpstreamChunk> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const session = await this.ensureSession(attempt > 0);
      try {
        const chat = await this.createChat({
          session,
          model: input.model,
          prompt: input.prompt,
          enableThinking: input.enableThinking,
          autoWebSearch: input.autoWebSearch,
        });
        const assistantMessageId = crypto.randomUUID();
        yield* this.openCompletionStream({
          session,
          recordId: chat.recordId,
          userMessageId: chat.userMessageId,
          assistantMessageId,
          prompt: input.prompt,
          model: input.model,
          enableThinking: input.enableThinking,
          autoWebSearch: input.autoWebSearch,
        });
        return;
      } catch (error) {
        if (error instanceof UpstreamHttpError && error.statusCode === 401) {
          this.clearCachedSession();
        }
        if (error instanceof UpstreamHttpError && error.statusCode === 401 && this.zaiJwt && attempt === 0) {
          continue;
        }
        throw error;
      }
    }
  }

  async collectPrompt(input: {
    prompt: string;
    model: string;
    enableThinking: boolean;
    autoWebSearch: boolean;
  }): Promise<UpstreamResult> {
    const answerParts: string[] = [];
    const reasoningParts: string[] = [];
    let usage: TokenUsage | undefined;

    for await (const chunk of this.streamPrompt(input)) {
      if (chunk.error) {
        throw new Error(chunk.error);
      }
      if (chunk.phase === "thinking") {
        reasoningParts.push(chunk.text);
      } else {
        answerParts.push(chunk.text);
      }
      if (chunk.usage) {
        usage = chunk.usage;
      }
    }

    return {
      answerText: answerParts.join(""),
      reasoningText: reasoningParts.join(""),
      usage: usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      finishReason: "stop",
    };
  }

  private async *openCompletionStream(input: {
    session: SessionState;
    recordId: string;
    userMessageId: string;
    assistantMessageId: string;
    prompt: string;
    model: string;
    enableThinking: boolean;
    autoWebSearch: boolean;
  }): AsyncGenerator<UpstreamChunk> {
    const timestampMs = String(Date.now());
    const requestId = crypto.randomUUID();
    const signature = await this.signPrompt({
      requestId,
      timestampMs,
      userId: input.session.userId,
      prompt: input.prompt,
    });
    const query = this.buildQuery({
      sessionToken: input.session.token,
      userId: input.session.userId,
      requestId,
      timestampMs,
    });
    const body = {
      stream: true,
      model: input.model,
      messages: [{ role: "user", content: input.prompt }],
      signature_prompt: input.prompt,
      params: {},
      extra: {},
      features: {
        image_generation: false,
        web_search: false,
        auto_web_search: input.autoWebSearch,
        preview_mode: false,
        flags: [],
        enable_thinking: input.enableThinking,
      },
      variables: this.defaultVariables(input.session.name),
      chat_id: input.recordId,
      id: input.assistantMessageId,
      current_user_message_id: input.userMessageId,
      current_user_message_parent_id: null,
      background_tasks: {
        title_generation: true,
        tags_generation: true,
      },
      stream_options: { include_usage: true },
    };

    const path = `/api/v2/chat/completions?${new URLSearchParams(query).toString()}&signature_timestamp=${timestampMs}`;
    const response = await this.request("POST", path, {
      headers: {
        Authorization: `Bearer ${input.session.token}`,
        Accept: "application/json, text/event-stream",
        "X-Signature": signature,
      },
      body: JSON.stringify(body),
    });

    if (!response.body) {
      throw new UpstreamRequestError("上游响应体为空", `POST ${path}`);
    }

    for await (const line of iterateLines(response.body)) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) {
        continue;
      }
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") {
        break;
      }
      const event = JSON.parse(payload) as { type?: string; data?: Record<string, unknown> };
      if (event.type !== "chat:completion") {
        continue;
      }
      const data = event.data ?? {};
      const error = data.error;
      if (error) {
        const detail = typeof error === "object" && error && "detail" in error ? String((error as Record<string, unknown>).detail) : String(error);
        yield { phase: null, text: "", done: true, error: detail };
        continue;
      }
      yield {
        phase: String(data.phase ?? "answer"),
        text: String(data.delta_content ?? data.content ?? ""),
        usage: data.usage ? normalizeUsage(data.usage) : undefined,
        done: Boolean(data.done),
      };
    }
  }

  private async exchangeToken(token: string): Promise<SessionState> {
    const response = await this.request("GET", "/api/v1/auths/", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const payload = await response.json<Record<string, unknown>>();
    return {
      token: String(payload.token),
      userId: String(payload.id),
      name: String(payload.name ?? ""),
      email: String(payload.email ?? ""),
      role: String(payload.role ?? "user"),
    };
  }

  private async request(method: string, path: string, init: { headers?: Record<string, string>; body?: BodyInit | null }): Promise<Response> {
    return requestWithConfig(this.config, method, path, init);
  }

  private async signPrompt(input: { requestId: string; timestampMs: string; userId: string; prompt: string }): Promise<string> {
    const payload = { requestId: input.requestId, timestamp: input.timestampMs, user_id: input.userId };
    const sortedPayload = Object.entries(payload)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key},${value}`)
      .join(",");
    const promptBase64 = toBase64(input.prompt);
    const bucket = String(Math.floor(Number(input.timestampMs) / (5 * 60 * 1000)));
    const key1 = await hmacHex(SIGNING_SECRET, bucket);
    return hmacHex(key1, `${sortedPayload}|${promptBase64}|${input.timestampMs}`);
  }

  private buildQuery(input: { sessionToken: string; userId: string; requestId: string; timestampMs: string }): Record<string, string> {
    const now = new Date();
    return {
      requestId: input.requestId,
      timestamp: input.timestampMs,
      user_id: input.userId,
      version: "0.0.1",
      platform: "web",
      token: input.sessionToken,
      user_agent: USER_AGENT,
      language: "en-US",
      languages: "en-US,en",
      timezone: "Asia/Taipei",
      cookie_enabled: "true",
      screen_width: "1920",
      screen_height: "1080",
      screen_resolution: "1920x1080",
      viewport_height: "1080",
      viewport_width: "1920",
      viewport_size: "1920x1080",
      color_depth: "24",
      pixel_ratio: "1",
      current_url: "https://chat.z.ai/",
      pathname: "/",
      search: "",
      hash: "",
      host: "chat.z.ai",
      hostname: "chat.z.ai",
      protocol: "https:",
      referrer: "https://chat.z.ai/",
      title: "Z.ai - Free AI Chatbot & Agent powered by GLM-5 & GLM-4.7",
      timezone_offset: "-480",
      local_time: formatFixedOffsetLocalTime(now, 8 * 60),
      utc_time: formatUtcTime(now),
      is_mobile: "false",
      is_touch: "false",
      max_touch_points: "0",
      browser_name: "Chrome",
      os_name: "Linux",
    };
  }

  private defaultVariables(name: string): Record<string, string> {
    const now = new Date();
    const taipei = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const date = taipei.toISOString().slice(0, 10);
    const time = taipei.toISOString().slice(11, 19);
    return {
      "{{USER_NAME}}": name,
      "{{USER_LOCATION}}": "Unknown",
      "{{CURRENT_DATETIME}}": `${date} ${time}`,
      "{{CURRENT_DATE}}": date,
      "{{CURRENT_TIME}}": time,
      "{{CURRENT_WEEKDAY}}": ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][taipei.getUTCDay()],
      "{{CURRENT_TIMEZONE}}": "UTC+8",
      "{{USER_LANGUAGE}}": "en-US",
    };
  }

  private sessionFromToken(token: string): SessionState {
    try {
      const payloadPart = token.split(".")[1] ?? "";
      const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(payloadPart))) as Record<string, unknown>;
      return {
        token,
        userId: String(payload.id ?? "unknown"),
        name: String(payload.name ?? "unknown"),
        email: String(payload.email ?? ""),
        role: String(payload.role ?? "user"),
      };
    } catch {
      return { token, userId: "unknown", name: "unknown", email: "", role: "user" };
    }
  }

  private readCachedSession(): SessionState | null {
    if (!this.cacheKey) {
      return null;
    }
    const cached = sessionCache.get(this.cacheKey);
    if (!cached) {
      return null;
    }
    if (cached.expiresAt <= Date.now()) {
      sessionCache.delete(this.cacheKey);
      return null;
    }
    return cached.session;
  }

  private writeCachedSession(session: SessionState): void {
    if (!this.cacheKey) {
      return;
    }
    sessionCache.set(this.cacheKey, {
      session,
      expiresAt: Date.now() + SESSION_CACHE_TTL_MS,
    });
  }

  private clearCachedSession(): void {
    if (!this.cacheKey) {
      return;
    }
    sessionCache.delete(this.cacheKey);
  }
}
