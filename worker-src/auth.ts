import type { PasswordSource } from "./bindings";
import { API_PASSWORD_KEY, PANEL_PASSWORD_KEY, type AppConfig } from "./config";
import { hashPassword, makeSessionId, verifyPassword } from "./crypto";
import { D1Repository } from "./repository";
import { nowSeconds } from "./utils";

export class AuthService {
  constructor(
    private readonly config: AppConfig,
    private readonly repository: D1Repository,
  ) {}

  async panelPasswordSource(): Promise<PasswordSource> {
    if (this.config.panelPasswordEnv) {
      return "env";
    }
    if (await this.repository.getSetting(PANEL_PASSWORD_KEY)) {
      return "database";
    }
    return "disabled";
  }

  async apiPasswordSource(): Promise<PasswordSource> {
    if (this.config.apiPasswordEnv) {
      return "env";
    }
    if (await this.repository.getSetting(API_PASSWORD_KEY)) {
      return "database";
    }
    return "disabled";
  }

  async isApiAuthEnabled(): Promise<boolean> {
    return (await this.apiPasswordSource()) !== "disabled";
  }

  async verifyPanelPassword(password: string): Promise<boolean> {
    if (this.config.panelPasswordEnv !== null) {
      return password === this.config.panelPasswordEnv;
    }
    const stored = await this.repository.getSetting(PANEL_PASSWORD_KEY);
    if (!stored) {
      return false;
    }
    return verifyPassword(password, stored);
  }

  async verifyApiPassword(password: string): Promise<boolean> {
    if (!(await this.isApiAuthEnabled())) {
      return true;
    }
    if (this.config.apiPasswordEnv !== null) {
      return password === this.config.apiPasswordEnv;
    }
    const stored = await this.repository.getSetting(API_PASSWORD_KEY);
    if (!stored) {
      return false;
    }
    return verifyPassword(password, stored);
  }

  async updatePanelPassword(password: string): Promise<void> {
    await this.repository.setSetting(PANEL_PASSWORD_KEY, await hashPassword(password));
  }

  async updateApiPassword(password: string | null): Promise<void> {
    if (password) {
      await this.repository.setSetting(API_PASSWORD_KEY, await hashPassword(password));
      return;
    }
    await this.repository.deleteSetting(API_PASSWORD_KEY);
  }

  async createAdminSession(): Promise<{ sessionId: string; expiresAt: number }> {
    const sessionId = makeSessionId();
    const expiresAt = nowSeconds() + this.config.adminSessionTtlSeconds;
    await this.repository.createAdminSession(sessionId, expiresAt);
    return { sessionId, expiresAt };
  }

  async verifyAdminSession(sessionId: string | null): Promise<boolean> {
    if (!sessionId) {
      return false;
    }
    const session = await this.repository.getAdminSession(sessionId);
    if (!session) {
      return false;
    }
    if (session.expires_at <= nowSeconds()) {
      await this.repository.deleteAdminSession(sessionId);
      return false;
    }
    return true;
  }

  async deleteAdminSession(sessionId: string | null): Promise<void> {
    if (!sessionId) {
      return;
    }
    await this.repository.deleteAdminSession(sessionId);
  }

  extractApiPassword(request: Request): string | null {
    const authHeader = request.headers.get("authorization");
    if (authHeader) {
      const [scheme, value] = authHeader.split(/\s+/, 2);
      if (scheme?.toLowerCase() === "bearer" && value) {
        return value.trim();
      }
    }
    const apiKey = request.headers.get("x-api-key");
    if (apiKey) {
      return apiKey.trim();
    }
    return null;
  }
}
