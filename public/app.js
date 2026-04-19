const state = {
  bootstrap: null,
  accounts: [],
  guestSource: null,
  logs: [],
  security: null,
  currentView: "accounts",
};

const views = [...document.querySelectorAll("[data-view-panel]")];
const navButtons = [...document.querySelectorAll(".nav-button")];
const toast = document.getElementById("toast");

function showToast(message, duration = 3200) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    toast.hidden = true;
  }, duration);
}

async function api(path, options = {}) {
  const isAdminApi = path.startsWith("/api/admin");
  const response = await fetch(path, {
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(isAdminApi ? { "x-zai2api-admin-request": "same-origin" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }
  if (!response.ok) {
    throw new Error(payload?.detail || `请求失败: ${response.status}`);
  }
  return payload;
}

function setView(view) {
  state.currentView = view;
  navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  views.forEach((panel) => {
    panel.hidden = panel.dataset.viewPanel !== view;
  });
}

function renderHero() {
  const bootstrap = state.bootstrap || {};
  const accounts = bootstrap.accounts || {};
  const guest = bootstrap.guest_source || state.guestSource || {};
  let summaryText = "当前尚未配置任何可用账号。";
  if (accounts.persisted_healthy) {
    summaryText = `健康 ${accounts.persisted_healthy ?? 0} / 启用 ${accounts.persisted_enabled ?? 0} / 总计 ${accounts.persisted_total ?? 0} 个持久化账号。`;
  } else if (accounts.using_guest_source) {
    summaryText = accounts.persisted_total
      ? "当前没有健康持久化账号，正在使用游客来源。"
      : "当前没有持久化账号，正在使用游客来源。";
  } else if (accounts.using_env_fallback) {
    summaryText = accounts.persisted_total
      ? "当前没有健康持久化账号，正在使用环境变量兜底。"
      : "当前没有持久化账号，正在使用环境变量兜底。";
  } else if (guest.enabled && guest.status === "cooldown") {
    summaryText = "游客来源冷却中，当前没有可用持久化账号。";
  } else if (guest.enabled) {
    summaryText = "游客来源已启用，当前等待可用会话。";
  }
  document.getElementById("summary-text").textContent = summaryText;
  document.getElementById("hero-title").textContent = bootstrap.setup_required ? "后台尚未初始化" : "Cloudflare 后台已就绪";
  document.getElementById("hero-copy").textContent = summaryText;
  document.getElementById("panel-source-pill").textContent = `面板密码 · ${bootstrap.panel_password?.source || "unknown"}`;
  document.getElementById("api-source-pill").textContent = `API 密码 · ${bootstrap.api_password?.source || "unknown"}`;
}

function renderAccounts() {
  renderGuestSource();
  const grid = document.getElementById("accounts-grid");
  if (!state.accounts.length) {
    grid.innerHTML = '<div class="account-card"><h4>暂无持久化账号</h4><p class="muted">可直接添加新的 JWT，也可以仅依赖环境变量兜底。</p></div>';
    return;
  }
  grid.innerHTML = state.accounts.map((account) => `
    <article class="account-card">
      <div class="badge ${account.status === "active" ? "active" : account.status === "error" || account.status === "invalid" ? "error" : ""}">
        ${account.enabled ? "已启用" : "已停用"} · ${account.status}
      </div>
      <h4>${escapeHtml(account.name || account.email || account.user_id || `账号 ${account.id}`)}</h4>
      <div class="card-subtitle">${escapeHtml(account.email || account.user_id || "暂无身份信息")}</div>
      <div class="account-meta">
        <div>JWT：<code>${escapeHtml(account.masked_jwt || "—")}</code></div>
        <div>会话：<code>${escapeHtml(account.masked_session_token || "—")}</code></div>
        <div>调用次数：${account.request_count ?? 0}</div>
        <div>失败次数：${account.failure_count ?? 0}</div>
        <div>最近检查：${formatTimestamp(account.last_checked_at)}</div>
        <div>最近错误：${escapeHtml(account.last_error || "无")}</div>
      </div>
      <div class="card-actions">
        <button class="ghost" data-action="check" data-id="${account.id}">检测</button>
        <button class="ghost" data-action="${account.enabled ? "disable" : "enable"}" data-id="${account.id}">
          ${account.enabled ? "禁用" : "启用"}
        </button>
      </div>
    </article>
  `).join("");
}

function renderGuestSource() {
  const host = document.getElementById("guest-source-slot");
  const guest = state.guestSource || state.bootstrap?.guest_source;
  if (!guest) {
    host.innerHTML = "";
    return;
  }
  const statusClass = guestStatusClass(guest);
  const enabledText = guest.enabled ? "已启用" : "未启用";
  const rotationText = guest.in_rotation ? "参与轮询" : "暂未参与轮询";
  host.innerHTML = `
    <article class="account-card">
      <div class="badge ${statusClass}">${enabledText} · ${guestStatusLabel(guest.status)}</div>
      <h4>游客来源</h4>
      <div class="card-subtitle">独立于持久化账号池的游客 session 来源</div>
      <div class="account-meta">
        <div>轮询状态：${rotationText}</div>
        <div>最近刷新：${formatTimestamp(guest.last_refreshed_at)}</div>
        <div>最近用户：${escapeHtml(guest.last_user_id || "—")}</div>
        <div>请求次数：${guest.request_count ?? 0}</div>
        <div>冷却截止：${formatTimestamp(guest.cooldown_until)}</div>
        <div>最近错误：${escapeHtml(guest.last_error || "无")}</div>
      </div>
    </article>
  `;
}

function renderSecurity() {
  if (!state.security) return;
  const form = document.getElementById("security-form");
  form.log_retention_days.value = state.security.log_retention?.days || 7;
  form.guest_enabled.checked = Boolean(state.security.guest_source?.enabled);
  form.guest_enabled.disabled = Boolean(state.security.guest_source?.overridden_by_env);
  document.getElementById("guest-source-setting-note").textContent = state.security.guest_source?.overridden_by_env
    ? "游客来源由环境变量控制，后台不可修改。"
    : `当前来源：${guestSettingSourceLabel(state.security.guest_source?.source)}。`;
}

function renderLogs() {
  const list = document.getElementById("logs-list");
  if (!state.logs.length) {
    list.innerHTML = '<div class="log-card"><h4>暂无日志</h4><p class="muted">等待请求和账号调度写入日志。</p></div>';
    return;
  }
  list.innerHTML = state.logs.map((log) => `
    <article class="log-card">
      <h4>${escapeHtml(log.message)}</h4>
      <div class="muted">${log.category} · ${log.level} · ${formatTimestamp(log.created_at)}</div>
      <pre>${escapeHtml(JSON.stringify(log.details || {}, null, 2))}</pre>
    </article>
  `).join("");
}

function updateAuthPanels() {
  const bootstrap = state.bootstrap || {};
  const setupRequired = Boolean(bootstrap.setup_required);
  const loggedIn = Boolean(bootstrap.logged_in);
  document.getElementById("setup-panel").hidden = !setupRequired;
  document.getElementById("login-panel").hidden = setupRequired || loggedIn;
  document.getElementById("view-stack").hidden = !loggedIn;
  document.getElementById("logout-button").hidden = !loggedIn;
}

async function loadBootstrap() {
  state.bootstrap = await api("/api/admin/bootstrap", { headers: {} });
  state.guestSource = state.bootstrap.guest_source || null;
  renderHero();
  updateAuthPanels();
  if (state.bootstrap.logged_in) {
    await Promise.all([loadAccounts(), loadSecurity(), loadLogs()]);
  }
}

async function loadAccounts() {
  const payload = await api("/api/admin/accounts", { headers: {} });
  state.accounts = payload.accounts || [];
  state.guestSource = payload.guest_source || state.guestSource;
  renderAccounts();
}

async function loadSecurity() {
  state.security = await api("/api/admin/settings/security", { headers: {} });
  renderSecurity();
}

async function loadLogs() {
  const payload = await api("/api/admin/logs?limit=50", { headers: {} });
  state.logs = payload.logs || [];
  renderLogs();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatTimestamp(value) {
  if (!value) return "—";
  return new Date(value * 1000).toLocaleString("zh-CN");
}

function guestStatusLabel(status) {
  switch (status) {
    case "active":
      return "活跃";
    case "cooldown":
      return "冷却中";
    case "error":
      return "异常";
    case "idle":
      return "待命";
    case "disabled":
      return "已关闭";
    default:
      return String(status || "未知");
  }
}

function guestStatusClass(guest) {
  if (!guest.enabled) return "";
  if (guest.status === "active") return "active";
  if (guest.status === "cooldown" || guest.status === "error") return "error";
  return "idle";
}

function guestSettingSourceLabel(source) {
  switch (source) {
    case "env":
      return "环境变量";
    case "database":
      return "后台设置";
    case "default":
      return "默认值";
    default:
      return String(source || "未知");
  }
}

document.getElementById("setup-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  const setupToken = String(payload.setup_token || "");
  delete payload.setup_token;
  try {
    await api("/api/admin/setup", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        authorization: `Bearer ${setupToken}`,
      },
    });
    showToast("后台初始化完成");
    form.reset();
    await loadBootstrap();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/admin/login", { method: "POST", body: JSON.stringify(payload) });
    showToast("登录成功");
    form.reset();
    await loadBootstrap();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("logout-button").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST", body: "{}" });
  state.accounts = [];
  state.guestSource = null;
  state.logs = [];
  state.security = null;
  await loadBootstrap();
});

document.getElementById("account-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const payload = Object.fromEntries(new FormData(form).entries());
  try {
    await api("/api/admin/accounts", { method: "POST", body: JSON.stringify(payload) });
    showToast("账号已保存");
    form.reset();
    await loadBootstrap();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("security-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const guestEnabledField = form.elements.namedItem("guest_enabled");
  const payload = {
    panel_password: data.get("panel_password"),
    api_password: data.get("api_password"),
    disable_api_password: data.get("disable_api_password") === "on",
    log_retention_days: data.get("log_retention_days"),
  };
  if (guestEnabledField && !guestEnabledField.disabled) {
    payload.guest_enabled = data.get("guest_enabled") === "on";
  }
  try {
    state.security = await api("/api/admin/settings/security", { method: "POST", body: JSON.stringify(payload) });
    showToast("安全设置已更新");
    form.panel_password.value = "";
    form.api_password.value = "";
    renderSecurity();
    await loadBootstrap();
  } catch (error) {
    showToast(error.message);
  }
});

document.getElementById("reload-accounts").addEventListener("click", () => loadAccounts().catch((error) => showToast(error.message)));
document.getElementById("reload-logs").addEventListener("click", () => loadLogs().catch((error) => showToast(error.message)));

document.getElementById("accounts-grid").addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const accountId = button.dataset.id;
  const action = button.dataset.action;
  const path =
    action === "check"
      ? `/api/admin/accounts/${accountId}/check`
      : `/api/admin/accounts/${accountId}/${action}`;
  try {
    await api(path, { method: "POST", body: "{}" });
    showToast("账号状态已更新");
    await loadBootstrap();
  } catch (error) {
    showToast(error.message);
  }
});

navButtons.forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

setView("accounts");
loadBootstrap().catch((error) => showToast(error.message));
