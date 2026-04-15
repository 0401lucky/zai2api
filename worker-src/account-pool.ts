import type { AccountRecord, SessionState, UpstreamChunk, UpstreamResult } from "./bindings";
import type { AppConfig } from "./config";
import { D1Repository } from "./repository";
import { ZAIClient, UpstreamHttpError, describeHttpError } from "./zai-client";

interface RoutedAccount {
  accountId: number | null;
  jwt: string | null;
  sessionToken: string | null;
  label: string;
  persistent: boolean;
}

type ClientFactory = (jwt: string | null, sessionToken: string | null) => ZAIClient;

let accountCursor = 0;

export class AccountPool {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: D1Repository,
    private readonly clientFactory: ClientFactory = (jwt, sessionToken) => new ZAIClient(config, jwt, sessionToken),
  ) {}

  async registerJwt(jwt: string): Promise<AccountRecord> {
    const client = this.clientFactory(jwt, null);
    const session = await client.ensureSession(true);
    const completionVersion = await client.verifyCompletionVersion();
    if (completionVersion !== 2) {
      throw new Error(`不支持的 Z.ai completion_version=${completionVersion}`);
    }
    const account = await this.repository.upsertAccount({
      jwt,
      sessionToken: session.token,
      userId: session.userId,
      email: session.email,
      name: session.name,
      enabled: true,
      status: "active",
      lastError: null,
      failureCount: 0,
    });
    await this.repository.addLog({
      level: "info",
      category: "accounts",
      message: "已通过 JWT 注册账号",
      details: { account_id: account.id, email: account.email, user_id: account.userId },
    });
    return account;
  }

  listAccounts(): Promise<AccountRecord[]> {
    return this.repository.listAccounts();
  }

  getAccount(accountId: number): Promise<AccountRecord | null> {
    return this.repository.getAccount(accountId);
  }

  async setAccountEnabled(accountId: number, enabled: boolean): Promise<AccountRecord> {
    const account = await this.repository.getAccount(accountId);
    if (!account) {
      throw new Error(`账号 ${accountId} 不存在`);
    }
    await this.repository.setAccountEnabled(accountId, enabled);
    await this.repository.addLog({
      level: "info",
      category: "accounts",
      message: "已更新账号启用状态",
      details: { account_id: accountId, enabled },
    });
    return (await this.repository.getAccount(accountId)) as AccountRecord;
  }

  async checkAccount(accountId: number): Promise<AccountRecord> {
    const account = await this.repository.getAccount(accountId);
    if (!account) {
      throw new Error(`账号 ${accountId} 不存在`);
    }
    const routed: RoutedAccount = {
      accountId: account.id,
      jwt: account.jwt,
      sessionToken: account.sessionToken,
      label: account.email ?? account.userId ?? `account-${account.id}`,
      persistent: true,
    };
    const client = this.clientFactory(account.jwt, account.sessionToken);
    try {
      const session = await client.ensureSession(Boolean(account.jwt));
      const completionVersion = await client.verifyCompletionVersion();
      if (completionVersion !== 2) {
        throw new Error(`不支持的 Z.ai completion_version=${completionVersion}`);
      }
      await this.repository.markAccountSuccess(account.id, {
        sessionToken: session.token,
        name: session.name,
        email: session.email,
      });
      await this.repository.addLog({
        level: "info",
        category: "accounts",
        message: "账号健康检查成功",
        details: { account_id: account.id, email: session.email },
      });
    } catch (error) {
      await this.handleFailure(routed, error);
    }
    return (await this.repository.getAccount(accountId)) as AccountRecord;
  }

  async checkAllAccounts(): Promise<AccountRecord[]> {
    const accounts = await this.repository.listAccounts({ enabledOnly: true });
    const results: AccountRecord[] = [];
    for (const account of accounts) {
      results.push(await this.checkAccount(account.id));
    }
    return results;
  }

  async collectPrompt(input: {
    prompt: string;
    model: string;
    enableThinking: boolean;
    autoWebSearch: boolean;
  }): Promise<UpstreamResult> {
    const candidates = await this.candidateAccounts();
    if (!candidates.length) {
      throw new Error("当前没有可用的启用账号");
    }
    let lastError: unknown;
    for (const routed of candidates) {
      const client = this.clientFactory(routed.jwt, routed.sessionToken);
      try {
        const result = await client.collectPrompt(input);
        await this.markSuccess(routed, client);
        return result;
      } catch (error) {
        lastError = error;
        await this.handleFailure(routed, error);
      }
    }
    throw lastError ?? new Error("当前没有可用的启用账号");
  }

  async *streamPrompt(input: {
    prompt: string;
    model: string;
    enableThinking: boolean;
    autoWebSearch: boolean;
  }): AsyncGenerator<UpstreamChunk> {
    const candidates = await this.candidateAccounts();
    if (!candidates.length) {
      throw new Error("当前没有可用的启用账号");
    }
    let lastError: unknown;
    for (const routed of candidates) {
      const client = this.clientFactory(routed.jwt, routed.sessionToken);
      let started = false;
      try {
        for await (const chunk of client.streamPrompt(input)) {
          started = true;
          yield chunk;
        }
        await this.markSuccess(routed, client);
        return;
      } catch (error) {
        lastError = error;
        await this.handleFailure(routed, error);
        if (started) {
          throw error;
        }
      }
    }
    throw lastError ?? new Error("当前没有可用的启用账号");
  }

  private async candidateAccounts(): Promise<RoutedAccount[]> {
    const persisted = (await this.repository.listAccounts({ enabledOnly: true, healthyOnly: true })).map((account) => ({
      accountId: account.id,
      jwt: account.jwt,
      sessionToken: account.sessionToken,
      label: account.email ?? account.userId ?? `account-${account.id}`,
      persistent: true,
    }));

    const cooldown =
      this.config.accountCooldownSeconds > 0
        ? (await this.repository.listCooldownAccounts(this.config.accountCooldownSeconds)).map((account) => ({
            accountId: account.id,
            jwt: account.jwt,
            sessionToken: account.sessionToken,
            label: account.email ?? account.userId ?? `account-${account.id}`,
            persistent: true,
          }))
        : [];

    const envFallback =
      this.config.zaiJwt || this.config.zaiSessionToken
        ? [
            {
              accountId: null,
              jwt: this.config.zaiJwt,
              sessionToken: this.config.zaiSessionToken,
              label: "env-bootstrap",
              persistent: false,
            },
          ]
        : [];

    if (persisted.length || cooldown.length) {
      const start = persisted.length ? accountCursor % persisted.length : 0;
      if (persisted.length) {
        accountCursor = (start + 1) % persisted.length;
      }
      return [...persisted.slice(start), ...persisted.slice(0, start), ...cooldown, ...envFallback];
    }
    if (envFallback.length) {
      return envFallback;
    }
    return [];
  }

  private async markSuccess(routed: RoutedAccount, client: ZAIClient): Promise<void> {
    if (!routed.persistent || routed.accountId === null) {
      return;
    }
    const session = await client.ensureSession();
    await this.repository.markAccountSuccess(routed.accountId, {
      sessionToken: session.token,
      name: session.name,
      email: session.email,
      countRequest: true,
    });
  }

  private async handleFailure(routed: RoutedAccount, error: unknown): Promise<void> {
    const disable = this.shouldDisable(error);
    const errorText = describeHttpError(error);
    let escalated = false;
    if (routed.persistent && routed.accountId !== null) {
      const account = await this.repository.getAccount(routed.accountId);
      const currentFailures = account ? account.failureCount : 0;
      escalated = !disable && currentFailures + 1 >= this.config.accountErrorThreshold;
      await this.repository.markAccountFailure(routed.accountId, errorText, disable, this.config.accountErrorThreshold);
    }
    await this.repository.addLog({
      level: "warning",
      category: "accounts",
      message: disable ? "账号认证失败已停用" : escalated ? "账号连续失败已移出候选池" : "账号请求临时失败（保留在候选池）",
      details: { account: routed.label, disable, escalated, error: errorText },
    });
  }

  private shouldDisable(error: unknown): boolean {
    if (error instanceof UpstreamHttpError) {
      return error.statusCode === 401;
    }
    if (error instanceof Error) {
      return error.message.includes("缺少 ZAI_JWT 或 ZAI_SESSION_TOKEN");
    }
    return false;
  }
}
