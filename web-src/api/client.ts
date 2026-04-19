import type {
  AccountMutationResponse,
  AccountsResponse,
  Bootstrap,
  LoginPayload,
  LoginResponse,
  LogsResponse,
  OkResponse,
  SecuritySettings,
  SecurityUpdatePayload,
  SetupPayload,
  SetupResponse,
} from './types'

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface ErrorPayload {
  detail?: string
  message?: string
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase()
  const isAdminWrite = path.startsWith('/api/admin') && method !== 'GET'

  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    method,
    headers: {
      'content-type': 'application/json',
      ...(isAdminWrite ? { 'x-zai2api-admin-request': 'same-origin' } : {}),
      ...init.headers,
    },
  })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    payload = null
  }

  if (!response.ok) {
    const errorPayload = payload as ErrorPayload | null
    const detail = errorPayload?.detail ?? errorPayload?.message ?? `请求失败: ${response.status}`
    throw new ApiError(detail, response.status)
  }

  return payload as T
}

export const api = {
  bootstrap: () => request<Bootstrap>('/api/admin/bootstrap'),

  setup: (body: SetupPayload, setupToken: string) =>
    request<SetupResponse>('/api/admin/setup', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { authorization: `Bearer ${setupToken}` },
    }),

  login: (body: LoginPayload) =>
    request<LoginResponse>('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  logout: () =>
    request<OkResponse>('/api/admin/logout', {
      method: 'POST',
      body: '{}',
    }),

  listAccounts: () => request<AccountsResponse>('/api/admin/accounts'),

  createAccount: (jwt: string) =>
    request<AccountMutationResponse>('/api/admin/accounts', {
      method: 'POST',
      body: JSON.stringify({ jwt }),
    }),

  enableAccount: (id: number) =>
    request<AccountMutationResponse>(`/api/admin/accounts/${id}/enable`, {
      method: 'POST',
      body: '{}',
    }),

  disableAccount: (id: number) =>
    request<AccountMutationResponse>(`/api/admin/accounts/${id}/disable`, {
      method: 'POST',
      body: '{}',
    }),

  checkAccount: (id: number) =>
    request<AccountMutationResponse>(`/api/admin/accounts/${id}/check`, {
      method: 'POST',
      body: '{}',
    }),

  listLogs: (limit = 50) => request<LogsResponse>(`/api/admin/logs?limit=${limit}`),

  getSecurity: () => request<SecuritySettings>('/api/admin/settings/security'),

  updateSecurity: (body: SecurityUpdatePayload) =>
    request<SecuritySettings>('/api/admin/settings/security', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
}

export type Api = typeof api
