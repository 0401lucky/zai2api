// 前端 API 响应类型，与 worker-src/helpers.ts 的 serialize* 函数保持对齐。

export type PasswordSource = 'env' | 'database' | 'default' | 'disabled'
export type LogRetentionSource = PasswordSource
export type GuestSourceSetting = PasswordSource

export interface PanelPasswordField {
  source: PasswordSource
  default_password_active: boolean
  overridden_by_env: boolean
}

export interface ApiPasswordField {
  source: PasswordSource
  enabled: boolean
  overridden_by_env: boolean
}

export interface AccountsSummary {
  persisted_total: number
  persisted_enabled: number
  persisted_healthy: number
  using_guest_source: boolean
  using_env_fallback: boolean
}

export type GuestStatus = 'active' | 'cooldown' | 'error' | 'idle' | 'disabled' | (string & {})

export interface GuestSource {
  enabled: boolean
  status: GuestStatus
  in_rotation: boolean
  last_refreshed_at: number | null
  last_error: string | null
  request_count: number
  cooldown_until: number | null
  last_user_id: string | null
}

export interface Bootstrap {
  logged_in: boolean
  setup_required: boolean
  panel_password: PanelPasswordField
  api_password: ApiPasswordField
  accounts: AccountsSummary
  guest_source: GuestSource
  frontend_ready: boolean
}

export type AccountStatus = 'active' | 'idle' | 'error' | 'invalid' | 'disabled' | (string & {})

export interface Account {
  id: number
  user_id: string | null
  email: string | null
  name: string | null
  enabled: boolean
  status: AccountStatus
  last_checked_at: number | null
  last_error: string | null
  failure_count: number
  request_count: number
  masked_jwt: string | null
  masked_session_token: string | null
  created_at: number
  updated_at: number
}

export interface AccountsResponse {
  accounts: Account[]
  guest_source: GuestSource
}

export interface AccountMutationResponse {
  account: Account
}

export type LogLevel = 'info' | 'warning' | 'error' | 'debug' | (string & {})

export interface LogEntry {
  id: number
  created_at: number
  level: LogLevel
  category: string
  message: string
  details: Record<string, unknown> | null
}

export interface LogsResponse {
  logs: LogEntry[]
}

export interface SecuritySettings {
  panel_password: PanelPasswordField
  api_password: ApiPasswordField
  log_retention: {
    days: number
    source: LogRetentionSource
    overridden_by_env: boolean
    default_active: boolean
  }
  guest_source: {
    enabled: boolean
    source: GuestSourceSetting
    overridden_by_env: boolean
    default_active: boolean
  }
  poll_interval_seconds: number
}

export interface SetupPayload {
  panel_password: string
  api_password?: string
  log_retention_days?: number
}

export interface SetupResponse {
  ok: true
  expires_at: number
  security: SecuritySettings
}

export interface LoginPayload {
  password: string
}

export interface LoginResponse {
  ok: true
  expires_at: number
}

export interface SecurityUpdatePayload {
  panel_password?: string
  api_password?: string
  disable_api_password?: boolean
  log_retention_days?: number
  guest_enabled?: boolean
}

export interface OkResponse {
  ok: true
}
