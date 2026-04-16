import type { GuestSourceSnapshot, SessionState, UpstreamChunk, UpstreamResult } from "./bindings";
import { GUEST_SOURCE_ENABLED_KEY, GUEST_SOURCE_STATE_KEY, type AppConfig } from "./config";
import { D1Repository } from "./repository";
import { nowSeconds, parseBoolean, safeJsonParse } from "./utils";
import { UpstreamHttpError, ZAIClient, describeHttpError, requestGuestSession } from "./zai-client";

type PromptRequest = {
  prompt: string;
  model: string;
  enableThinking: boolean;
  autoWebSearch: boolean;
};

type GuestSessionFactory = () => Promise<SessionState>;
type GuestClientFactory = (sessionToken: string) => ZAIClient;

interface GuestSourceStateRecord {
  status: Exclude<GuestSourceSnapshot["status"], "disabled">;
  lastRefreshedAt: number | null;
  lastError: string | null;
  requestCount: number;
  cooldownUntil: number | null;
  lastUserId: string | null;
}

const guestSessionCache = new Map<string, SessionState>();
const guestSessionInflight = new Map<string, Promise<SessionState>>();

function defaultState(): GuestSourceStateRecord {
  return {
    status: "idle",
    lastRefreshedAt: null,
    lastError: null,
    requestCount: 0,
    cooldownUntil: null,
    lastUserId: null,
  };
}

function normalizeState(raw: Partial<GuestSourceStateRecord> | null): GuestSourceStateRecord {
  const base = defaultState();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  return {
    status:
      raw.status === "active" || raw.status === "cooldown" || raw.status === "error" || raw.status === "idle"
        ? raw.status
        : base.status,
    lastRefreshedAt: typeof raw.lastRefreshedAt === "number" ? raw.lastRefreshedAt : null,
    lastError: typeof raw.lastError === "string" ? raw.lastError : null,
    requestCount: typeof raw.requestCount === "number" ? raw.requestCount : 0,
    cooldownUntil: typeof raw.cooldownUntil === "number" ? raw.cooldownUntil : null,
    lastUserId: typeof raw.lastUserId === "string" ? raw.lastUserId : null,
  };
}

export class GuestSourceManager {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: D1Repository,
    private readonly clientFactory: GuestClientFactory = (sessionToken) => new ZAIClient(config, null, sessionToken),
    private readonly sessionFactory: GuestSessionFactory = () => requestGuestSession(config),
  ) {}

  async isEnabled(): Promise<boolean> {
    if (this.config.guestEnabledEnv !== null) {
      return this.config.guestEnabledEnv;
    }
    const stored = await this.repository.getSetting(GUEST_SOURCE_ENABLED_KEY);
    if (stored !== null) {
      return parseBoolean(stored, false);
    }
    return this.config.guestEnabled;
  }

  async enabledSource(): Promise<"env" | "database" | "default"> {
    if (this.config.guestEnabledEnv !== null) {
      return "env";
    }
    if ((await this.repository.getSetting(GUEST_SOURCE_ENABLED_KEY)) !== null) {
      return "database";
    }
    return "default";
  }

  async updateEnabled(enabled: boolean): Promise<void> {
    await this.repository.setSetting(GUEST_SOURCE_ENABLED_KEY, enabled ? "true" : "false");
  }

  async getSnapshot(): Promise<GuestSourceSnapshot> {
    const enabled = await this.isEnabled();
    const state = this.normalizeForSnapshot(await this.readState());
    return {
      enabled,
      status: enabled ? state.status : "disabled",
      inRotation: enabled && this.isEligible(state),
      lastRefreshedAt: state.lastRefreshedAt,
      lastError: state.lastError,
      requestCount: state.requestCount,
      cooldownUntil: state.cooldownUntil,
      lastUserId: state.lastUserId,
    };
  }

  async collectPrompt(input: PromptRequest): Promise<UpstreamResult> {
    await this.ensureEnabled();
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await this.ensureUsable();
        const client = await this.buildClient(attempt > 0);
        const result = await client.collectPrompt(input);
        await this.recordSuccess(client);
        return result;
      } catch (error) {
        lastError = error;
        const canRetry = this.shouldRebuild(error) && attempt === 0;
        this.clearCachedSession();
        if (canRetry) {
          await this.repository.addLog({
            level: "warning",
            category: "guest_source",
            message: "游客会话失效，正在重建",
            details: { error: describeHttpError(error) },
          });
          continue;
        }
        await this.recordFailure(error);
        throw error;
      }
    }

    throw lastError ?? new Error("游客来源当前不可用");
  }

  async *streamPrompt(input: PromptRequest): AsyncGenerator<UpstreamChunk> {
    await this.ensureEnabled();
    let lastError: unknown;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      let started = false;
      try {
        await this.ensureUsable();
        const client = await this.buildClient(attempt > 0);
        for await (const chunk of client.streamPrompt(input)) {
          started = true;
          if (chunk.error) {
            await this.recordFailure(new Error(chunk.error));
            yield chunk;
            return;
          }
          yield chunk;
        }
        await this.recordSuccess(client);
        return;
      } catch (error) {
        lastError = error;
        const canRetry = this.shouldRebuild(error) && !started && attempt === 0;
        this.clearCachedSession();
        if (canRetry) {
          await this.repository.addLog({
            level: "warning",
            category: "guest_source",
            message: "游客会话失效，正在重建",
            details: { error: describeHttpError(error) },
          });
          continue;
        }
        await this.recordFailure(error);
        throw error;
      }
    }

    throw lastError ?? new Error("游客来源当前不可用");
  }

  private async buildClient(forceRefresh: boolean): Promise<ZAIClient> {
    const session = await this.ensureSession(forceRefresh);
    return this.clientFactory(session.token);
  }

  private async ensureSession(forceRefresh: boolean): Promise<SessionState> {
    if (!forceRefresh) {
      const cached = guestSessionCache.get(this.cacheKey);
      if (cached) {
        return cached;
      }
    } else {
      this.clearCachedSession();
    }

    let pending = forceRefresh ? undefined : guestSessionInflight.get(this.cacheKey);
    if (!pending) {
      pending = this.sessionFactory();
      guestSessionInflight.set(this.cacheKey, pending);
    }

    try {
      const previous = guestSessionCache.get(this.cacheKey);
      const session = await pending;
      guestSessionCache.set(this.cacheKey, session);
      const state = await this.readState();
      await this.writeState({
        ...state,
        status: "active",
        lastRefreshedAt: nowSeconds(),
        lastError: null,
        cooldownUntil: null,
        lastUserId: session.userId,
      });
      await this.repository.addLog({
        level: "info",
        category: "guest_source",
        message: previous ? "游客会话已重建" : "游客会话已建立",
        details: { user_id: session.userId },
      });
      return session;
    } finally {
      if (guestSessionInflight.get(this.cacheKey) === pending) {
        guestSessionInflight.delete(this.cacheKey);
      }
    }
  }

  private async recordSuccess(client: ZAIClient): Promise<void> {
    const previous = guestSessionCache.get(this.cacheKey)?.token ?? null;
    const session = await client.ensureSession();
    guestSessionCache.set(this.cacheKey, session);
    const current = await this.readState();
    const refreshedAt =
      previous === session.token ? current.lastRefreshedAt : nowSeconds();
    await this.writeState({
      ...current,
      status: "active",
      lastRefreshedAt: refreshedAt,
      lastError: null,
      cooldownUntil: null,
      requestCount: current.requestCount + 1,
      lastUserId: session.userId,
    });
  }

  private async recordFailure(error: unknown): Promise<void> {
    const detail = describeHttpError(error);
    const current = await this.readState();
    const cooldownUntil = this.config.accountCooldownSeconds > 0 ? nowSeconds() + this.config.accountCooldownSeconds : null;
    await this.writeState({
      ...current,
      status: cooldownUntil === null ? "error" : "cooldown",
      lastError: detail,
      cooldownUntil,
    });
    await this.repository.addLog({
      level: "warning",
      category: "guest_source",
      message: cooldownUntil === null ? "游客来源请求失败" : "游客来源请求失败，已进入冷却",
      details: { error: detail, cooldown_until: cooldownUntil },
    });
  }

  private async ensureUsable(): Promise<void> {
    const snapshot = await this.getSnapshot();
    if (snapshot.inRotation) {
      return;
    }
    if (!snapshot.enabled) {
      throw new Error("游客来源未启用");
    }
    if (snapshot.status === "cooldown" && snapshot.cooldownUntil) {
      throw new Error(`游客来源冷却中，${snapshot.cooldownUntil - nowSeconds()} 秒后重试`);
    }
    throw new Error("游客来源当前不可用");
  }

  private shouldRebuild(error: unknown): boolean {
    return error instanceof UpstreamHttpError && error.statusCode === 401;
  }

  private clearCachedSession(): void {
    guestSessionCache.delete(this.cacheKey);
  }

  private async readState(): Promise<GuestSourceStateRecord> {
    const raw = safeJsonParse<Partial<GuestSourceStateRecord>>(await this.repository.getSetting(GUEST_SOURCE_STATE_KEY));
    return normalizeState(raw);
  }

  private async writeState(state: GuestSourceStateRecord): Promise<void> {
    await this.repository.setSetting(GUEST_SOURCE_STATE_KEY, JSON.stringify(state));
  }

  private normalizeForSnapshot(state: GuestSourceStateRecord): GuestSourceStateRecord {
    if (state.status === "cooldown" && state.cooldownUntil !== null && state.cooldownUntil <= nowSeconds()) {
      return {
        ...state,
        status: guestSessionCache.has(this.cacheKey) ? "active" : "idle",
        cooldownUntil: null,
      };
    }
    if (state.status === "active" && !guestSessionCache.has(this.cacheKey)) {
      return {
        ...state,
        status: "idle",
      };
    }
    return state;
  }

  private isEligible(state: GuestSourceStateRecord): boolean {
    return state.status !== "cooldown";
  }

  private async ensureEnabled(): Promise<void> {
    if (!(await this.isEnabled())) {
      throw new Error("游客来源未启用");
    }
  }

  private get cacheKey(): string {
    return `guest:${this.config.zaiBaseUrl}`;
  }
}
