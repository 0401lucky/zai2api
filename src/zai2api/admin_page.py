from __future__ import annotations

from textwrap import dedent


def render_admin_page() -> str:
    return dedent(
        """
        <!doctype html>
        <html lang="zh-CN">
          <head>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <title>zai2api Control Center</title>
            <style>
              :root {
                color-scheme: light;
                --bg-page: #f3f6fb;
                --bg-page-strong: #eef3fb;
                --bg-panel: rgba(255, 255, 255, 0.84);
                --bg-panel-solid: #ffffff;
                --bg-soft: rgba(242, 247, 255, 0.92);
                --bg-subtle: rgba(231, 239, 251, 0.72);
                --line: rgba(20, 56, 102, 0.09);
                --line-strong: rgba(20, 56, 102, 0.16);
                --text-0: #14304f;
                --text-1: #4f6785;
                --text-2: #7f95b1;
                --accent: #2563eb;
                --accent-strong: #3b82f6;
                --accent-soft: rgba(37, 99, 235, 0.12);
                --accent-softer: rgba(37, 99, 235, 0.08);
                --danger: #d14343;
                --danger-soft: rgba(209, 67, 67, 0.1);
                --success: #1f8f63;
                --success-soft: rgba(31, 143, 99, 0.12);
                --warning: #b7791f;
                --warning-soft: rgba(183, 121, 31, 0.12);
                --shadow-lg: 0 28px 72px rgba(33, 78, 143, 0.14);
                --shadow-md: 0 12px 36px rgba(33, 78, 143, 0.1);
                --radius-xl: 28px;
                --radius-lg: 22px;
                --radius-md: 16px;
                --radius-sm: 12px;
              }

              * { box-sizing: border-box; }
              html, body { min-height: 100%; }
              body {
                margin: 0;
                min-height: 100vh;
                font-family: "Segoe UI Variable Text", "Segoe UI", "Noto Sans SC", system-ui, sans-serif;
                background:
                  radial-gradient(circle at top left, rgba(59, 130, 246, 0.16), transparent 32%),
                  radial-gradient(circle at top right, rgba(14, 165, 233, 0.1), transparent 24%),
                  radial-gradient(circle at bottom right, rgba(125, 211, 252, 0.22), transparent 28%),
                  linear-gradient(180deg, #f7faff 0%, #f3f6fb 44%, #eef3fb 100%);
                color: var(--text-0);
                overflow: auto;
              }

              body::before,
              body::after {
                content: "";
                position: fixed;
                inset: 0;
                pointer-events: none;
              }

              body::before {
                background:
                  linear-gradient(rgba(255, 255, 255, 0.42) 1px, transparent 1px),
                  linear-gradient(90deg, rgba(255, 255, 255, 0.42) 1px, transparent 1px);
                background-size: 28px 28px;
                mask-image: radial-gradient(circle at center, black 40%, transparent 88%);
                opacity: 0.45;
              }

              body::after {
                background:
                  radial-gradient(circle at 14% 12%, rgba(59, 130, 246, 0.16), transparent 18%),
                  radial-gradient(circle at 86% 22%, rgba(56, 189, 248, 0.16), transparent 20%),
                  radial-gradient(circle at 75% 88%, rgba(37, 99, 235, 0.08), transparent 20%);
              }

              code {
                font-family: "Cascadia Code", "Consolas", monospace;
                background: rgba(226, 236, 251, 0.9);
                color: #184a8b;
                border-radius: 10px;
                padding: 2px 8px;
              }

              .shell {
                position: relative;
                display: grid;
                grid-template-columns: 296px minmax(0, 1fr);
                gap: 20px;
                align-items: start;
                min-height: 100vh;
                padding: clamp(16px, 2vw, 24px);
              }

              .panel {
                background: var(--bg-panel);
                border: 1px solid var(--line);
                border-radius: var(--radius-xl);
                box-shadow: var(--shadow-lg);
                backdrop-filter: blur(26px) saturate(180%);
                -webkit-backdrop-filter: blur(26px) saturate(180%);
              }

              .sidebar {
                position: sticky;
                top: 20px;
                align-self: start;
                display: flex;
                flex-direction: column;
                gap: 18px;
                padding: 24px;
                max-height: calc(100vh - 40px);
                overflow: auto;
              }

              .brand {
                display: grid;
                gap: 12px;
              }

              .brand-badge {
                width: 56px;
                height: 56px;
                border-radius: 20px;
                background:
                  linear-gradient(145deg, rgba(255, 255, 255, 0.92), rgba(227, 238, 255, 0.96)),
                  linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(14, 165, 233, 0.18));
                box-shadow:
                  inset 0 1px 0 rgba(255, 255, 255, 0.9),
                  0 18px 28px rgba(37, 99, 235, 0.14);
                display: grid;
                place-items: center;
                font-size: 24px;
                color: var(--accent);
              }

              .brand-title {
                font-size: 24px;
                font-weight: 700;
                letter-spacing: -0.02em;
              }

              .brand-copy {
                color: var(--text-1);
                line-height: 1.6;
                font-size: 14px;
              }

              .nav-list {
                display: grid;
                gap: 10px;
                margin-top: 8px;
              }

              .nav-button,
              .ghost-button,
              .primary-button,
              .secondary-button,
              .danger-button {
                border: 1px solid transparent;
                border-radius: 16px;
                background: transparent;
                color: inherit;
                cursor: pointer;
                transition: 160ms ease;
                font: inherit;
              }

              .nav-button {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                width: 100%;
                padding: 14px 16px;
                text-align: left;
                color: var(--text-1);
              }

              .nav-button:hover {
                background: rgba(255, 255, 255, 0.76);
                border-color: var(--line);
                color: var(--text-0);
                transform: translateY(-1px);
              }

              .nav-button.active {
                background: linear-gradient(180deg, rgba(239, 245, 255, 0.98), rgba(229, 239, 255, 0.92));
                border-color: rgba(37, 99, 235, 0.14);
                color: var(--accent);
                box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.9);
              }

              .nav-meta {
                color: var(--text-2);
                font-size: 12px;
                white-space: nowrap;
              }

              .sidebar-footer {
                margin-top: auto;
                padding: 18px;
                border: 1px solid var(--line);
                border-radius: var(--radius-lg);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(242, 247, 255, 0.9));
              }

              .main {
                min-width: 0;
                min-height: calc(100vh - 48px);
                display: flex;
                flex-direction: column;
                gap: 18px;
                padding: 20px;
                overflow: hidden;
              }

              .topbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 14px;
                flex-wrap: wrap;
                padding: 16px 18px;
                border-radius: 22px;
                border: 1px solid var(--line);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(246, 249, 255, 0.78));
              }

              .headline {
                min-width: 0;
                display: grid;
                gap: 6px;
              }

              .headline h1 {
                margin: 0;
                font-size: clamp(24px, 3vw, 32px);
                line-height: 1.1;
                letter-spacing: -0.03em;
              }

              .headline p {
                margin: 0;
                color: var(--text-1);
                font-size: 14px;
              }

              .top-actions {
                display: flex;
                gap: 10px;
                align-items: center;
                flex-wrap: wrap;
              }

              .ghost-button,
              .secondary-button,
              .primary-button,
              .danger-button {
                min-height: 44px;
                padding: 11px 16px;
              }

              .ghost-button,
              .secondary-button,
              .danger-button {
                border-color: var(--line);
                background: rgba(255, 255, 255, 0.76);
                color: var(--text-0);
              }

              .ghost-button:hover,
              .secondary-button:hover,
              .danger-button:hover {
                background: #ffffff;
                border-color: var(--line-strong);
                transform: translateY(-1px);
              }

              .primary-button {
                background: linear-gradient(180deg, #3b82f6, #2563eb);
                color: #ffffff;
                font-weight: 700;
                border-color: rgba(37, 99, 235, 0.18);
                box-shadow: 0 12px 24px rgba(37, 99, 235, 0.18);
              }

              .primary-button:hover {
                transform: translateY(-1px);
                box-shadow: 0 16px 28px rgba(37, 99, 235, 0.24);
              }

              .danger-button {
                color: var(--danger);
                background: rgba(255, 247, 247, 0.96);
                border-color: rgba(209, 67, 67, 0.16);
              }

              .primary-button:disabled,
              .secondary-button:disabled,
              .ghost-button:disabled,
              .danger-button:disabled {
                opacity: 0.56;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
              }

              .content {
                min-height: 0;
                flex: 1 1 auto;
                display: flex;
                flex-direction: column;
                gap: 18px;
                overflow: auto;
                padding-right: 4px;
              }

              .hero,
              .split-grid,
              .stats-grid,
              .placeholder-grid,
              .account-grid,
              .security-grid {
                display: grid;
                gap: 18px;
                min-width: 0;
              }

              .hero { grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.85fr); }
              .split-grid { grid-template-columns: minmax(300px, 400px) minmax(0, 1fr); }
              .stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
              .placeholder-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
              .account-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
              .security-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }

              .hero-card,
              .mini-card,
              .view-card,
              .login-card,
              .toast,
              .inline-card,
              .account-card,
              .log-card,
              .form-card {
                min-width: 0;
                border: 1px solid var(--line);
                background: rgba(255, 255, 255, 0.86);
                border-radius: var(--radius-lg);
                box-shadow: var(--shadow-md);
              }

              .hero-card,
              .view-card,
              .form-card {
                padding: 22px;
                display: grid;
                gap: 18px;
              }

              .mini-card,
              .inline-card,
              .account-card,
              .log-card {
                padding: 16px;
                display: grid;
                gap: 10px;
              }

              .hero-kicker,
              .chip {
                display: inline-flex;
                width: fit-content;
                max-width: 100%;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 999px;
                background: rgba(37, 99, 235, 0.08);
                border: 1px solid rgba(37, 99, 235, 0.12);
                color: var(--accent);
                font-size: 12px;
                letter-spacing: 0.04em;
                text-transform: uppercase;
              }

              .hero-title {
                margin: 0;
                font-size: clamp(30px, 4vw, 38px);
                line-height: 1.05;
                letter-spacing: -0.045em;
                max-width: 15ch;
              }

              .hero-text,
              .metric-copy,
              .placeholder-copy,
              .muted-copy,
              .field-hint,
              .login-copy {
                color: var(--text-1);
                line-height: 1.65;
              }

              .metric-label {
                color: var(--text-2);
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.08em;
              }

              .metric-value {
                font-size: clamp(24px, 3vw, 30px);
                line-height: 1.1;
                font-weight: 700;
                color: var(--text-0);
              }

              .view-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 16px;
                flex-wrap: wrap;
              }

              .view-header h2,
              .login-title {
                margin: 0;
                color: var(--text-0);
                font-size: 22px;
                line-height: 1.2;
              }

              .toolbar {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
                align-items: center;
              }

              .placeholder-tile {
                padding: 18px;
                border-radius: 18px;
                border: 1px solid var(--line);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(243, 247, 255, 0.88));
                display: grid;
                gap: 10px;
              }

              .status-pill {
                display: inline-flex;
                width: fit-content;
                max-width: 100%;
                flex-wrap: wrap;
                align-items: center;
                gap: 8px;
                padding: 8px 12px;
                border-radius: 999px;
                border: 1px solid var(--line);
                background: rgba(244, 248, 255, 0.94);
                color: var(--text-1);
                font-size: 13px;
              }

              .status-dot {
                width: 8px;
                height: 8px;
                border-radius: 999px;
                background: var(--warning);
                box-shadow: 0 0 0 4px rgba(183, 121, 31, 0.08);
                flex: 0 0 auto;
              }

              .status-dot.success {
                background: var(--success);
                box-shadow: 0 0 0 4px rgba(31, 143, 99, 0.08);
              }

              .status-dot.error {
                background: var(--danger);
                box-shadow: 0 0 0 4px rgba(209, 67, 67, 0.08);
              }

              .field-group {
                display: grid;
                gap: 10px;
                min-width: 0;
              }

              .field-row {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 14px;
              }

              .field-label {
                color: var(--text-1);
                font-size: 13px;
                font-weight: 600;
              }

              .field-input,
              .field-textarea {
                width: 100%;
                min-height: 50px;
                padding: 14px 16px;
                border-radius: 16px;
                border: 1px solid rgba(20, 56, 102, 0.12);
                background: rgba(248, 251, 255, 0.92);
                color: var(--text-0);
                outline: none;
                transition: 160ms ease;
                resize: vertical;
                font: inherit;
              }

              .field-textarea { min-height: 150px; }

              .field-input:focus,
              .field-textarea:focus {
                border-color: rgba(37, 99, 235, 0.38);
                box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.12);
              }

              .inline-actions,
              .account-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 10px;
              }

              .account-card-header,
              .log-card-header {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                align-items: flex-start;
                flex-wrap: wrap;
              }

              .account-card-title,
              .log-card-title {
                font-size: 18px;
                font-weight: 700;
                margin: 0;
                line-height: 1.3;
                color: var(--text-0);
              }

              .account-meta,
              .log-meta {
                color: var(--text-2);
                font-size: 13px;
                line-height: 1.5;
              }

              .detail-list {
                display: grid;
                gap: 10px;
                min-width: 0;
              }

              .detail-row {
                display: grid;
                grid-template-columns: minmax(90px, 110px) minmax(0, 1fr);
                gap: 10px;
                align-items: start;
                min-width: 0;
              }

              .detail-row code,
              .log-details {
                display: block;
                max-width: 100%;
                font-family: "Cascadia Code", "Consolas", monospace;
                background: rgba(239, 244, 253, 0.96);
                color: #31527c;
                border-radius: 12px;
                padding: 8px 10px;
                overflow: auto;
                white-space: pre-wrap;
                word-break: break-word;
                overflow-wrap: anywhere;
              }

              .login-layer {
                position: fixed;
                inset: 0;
                display: grid;
                place-items: center;
                padding: 24px;
                background: rgba(236, 242, 251, 0.72);
                backdrop-filter: blur(18px);
                z-index: 30;
              }

              .login-card {
                width: min(100%, 480px);
                padding: 28px;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(246, 249, 255, 0.94));
                display: grid;
                gap: 18px;
                border: 1px solid var(--line);
                border-radius: var(--radius-lg);
                box-shadow: 0 26px 60px rgba(34, 76, 140, 0.16);
              }

              .banner {
                padding: 14px 16px;
                border-radius: 16px;
                border: 1px solid transparent;
                font-size: 14px;
                line-height: 1.6;
              }

              .banner.info {
                background: rgba(37, 99, 235, 0.08);
                border-color: rgba(37, 99, 235, 0.12);
                color: #28518f;
              }

              .banner.warn {
                background: var(--warning-soft);
                border-color: rgba(183, 121, 31, 0.14);
                color: #8a6019;
              }

              .banner.error {
                background: var(--danger-soft);
                border-color: rgba(209, 67, 67, 0.14);
                color: #9c3535;
              }

              .toast-stack {
                position: fixed;
                right: 24px;
                bottom: 24px;
                display: grid;
                gap: 12px;
                z-index: 40;
              }

              .toast {
                padding: 14px 16px;
                min-width: min(320px, calc(100vw - 32px));
                max-width: min(380px, calc(100vw - 32px));
                color: var(--text-0);
                background: rgba(255, 255, 255, 0.96);
                border-left: 4px solid var(--accent);
              }

              .toast.success { border-left-color: var(--success); }
              .toast.error { border-left-color: var(--danger); }
              .toast.warn { border-left-color: var(--warning); }

              .hidden { display: none !important; }

              @media (max-width: 1200px) {
                .hero,
                .split-grid,
                .security-grid {
                  grid-template-columns: 1fr;
                }

                .stats-grid {
                  grid-template-columns: repeat(2, minmax(0, 1fr));
                }
              }

              @media (max-width: 1080px) {
                .shell {
                  grid-template-columns: 1fr;
                  min-height: auto;
                }

                .sidebar {
                  position: relative;
                  top: 0;
                  max-height: none;
                }

                .main {
                  min-height: auto;
                }

                .placeholder-grid,
                .account-grid,
                .field-row {
                  grid-template-columns: 1fr;
                }
              }

              @media (max-width: 720px) {
                .shell,
                .main,
                .sidebar {
                  padding: 16px;
                }

                .topbar,
                .hero-card,
                .view-card,
                .form-card,
                .login-card {
                  padding: 18px;
                }

                .stats-grid {
                  grid-template-columns: 1fr;
                }

                .detail-row {
                  grid-template-columns: 1fr;
                }

                .toast-stack {
                  right: 12px;
                  left: 12px;
                  bottom: 12px;
                }
              }
            </style>
          </head>
          <body>
            <div class="shell">
              <aside class="panel sidebar">
                <div class="brand">
                  <div class="brand-badge">✦</div>
                  <div class="brand-title">zai2api Control</div>
                  <div class="brand-copy">
                    Fluent-inspired operation center for account orchestration,
                    security governance, and runtime visibility.
                  </div>
                </div>

                <nav class="nav-list" id="nav-list"></nav>

                <div class="sidebar-footer">
                  <div class="metric-label">Runtime posture</div>
                  <div class="muted-copy" id="sidebar-posture">
                    Waiting for bootstrap diagnostics.
                  </div>
                </div>
              </aside>

              <main class="panel main">
                <div class="topbar">
                  <div class="headline">
                    <h1 id="headline-title">Preparing control center...</h1>
                    <p id="headline-copy">Synchronizing admin state and security posture.</p>
                  </div>
                  <div class="top-actions">
                    <button class="ghost-button" id="refresh-button">Refresh</button>
                    <button class="secondary-button" id="logout-button">Sign out</button>
                  </div>
                </div>

                <section class="content" id="content-root"></section>
              </main>
            </div>

            <section class="login-layer hidden" id="login-layer">
              <form class="login-card" id="login-form">
                <div>
                  <div class="hero-kicker">Admin Authentication</div>
                </div>
                <div>
                  <h2 class="login-title">Unlock the control plane</h2>
                  <p class="login-copy">
                    Enter the panel password to access account routing, audit signals,
                    and security controls.
                  </p>
                </div>
                <div class="banner info" id="login-hint"></div>
                <div class="field-group">
                  <label class="field-label" for="panel-password">Panel password</label>
                  <input class="field-input" id="panel-password" type="password" autocomplete="current-password" />
                  <div class="field-hint">If no env or database password is configured, the active default is <strong>123456</strong>.</div>
                </div>
                <button class="primary-button" id="login-submit" type="submit">Sign in</button>
                <div class="banner error hidden" id="login-error"></div>
              </form>
            </section>

            <div class="toast-stack" id="toast-stack"></div>

            <script>
              const views = [
                { id: 'overview', label: 'Overview', meta: 'Live posture' },
                { id: 'accounts', label: 'Accounts', meta: 'Pool operations' },
                { id: 'security', label: 'Security', meta: 'Passwords & policy' },
                { id: 'logs', label: 'Logs', meta: 'Audit signal' },
              ];

              const state = {
                currentView: 'overview',
                loggedIn: false,
                bootstrap: null,
                accounts: null,
                security: null,
                logs: null,
                loading: {
                  accounts: false,
                  security: false,
                  logs: false,
                },
              };

              const navList = document.getElementById('nav-list');
              const contentRoot = document.getElementById('content-root');
              const loginLayer = document.getElementById('login-layer');
              const loginForm = document.getElementById('login-form');
              const loginSubmit = document.getElementById('login-submit');
              const loginHint = document.getElementById('login-hint');
              const loginError = document.getElementById('login-error');
              const panelPassword = document.getElementById('panel-password');
              const refreshButton = document.getElementById('refresh-button');
              const logoutButton = document.getElementById('logout-button');
              const toastStack = document.getElementById('toast-stack');
              const headlineTitle = document.getElementById('headline-title');
              const headlineCopy = document.getElementById('headline-copy');
              const sidebarPosture = document.getElementById('sidebar-posture');

              function showToast(message, tone = 'info') {
                const node = document.createElement('div');
                node.className = `toast ${tone}`;
                node.textContent = message;
                toastStack.appendChild(node);
                setTimeout(() => {
                  node.style.opacity = '0';
                  node.style.transform = 'translateY(10px)';
                }, 2600);
                setTimeout(() => node.remove(), 3200);
              }

              function setTopBusy(flag) {
                refreshButton.disabled = flag;
                logoutButton.disabled = flag;
                loginSubmit.disabled = flag;
                loginSubmit.textContent = flag ? 'Signing in...' : 'Sign in';
              }

              function formatTimestamp(value) {
                if (!value) return '—';
                const date = new Date(value * 1000);
                return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
              }

              async function api(path, options = {}) {
                const response = await fetch(path, {
                  credentials: 'same-origin',
                  headers: { 'content-type': 'application/json', ...(options.headers || {}) },
                  ...options,
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload.detail || 'Request failed');
                }
                return payload;
              }

              function renderNav() {
                navList.innerHTML = views.map((view) => {
                  const active = view.id === state.currentView ? 'active' : '';
                  return `
                    <button class="nav-button ${active}" data-view="${view.id}">
                      <span>${view.label}</span>
                      <span class="nav-meta">${view.meta}</span>
                    </button>
                  `;
                }).join('');
              }

              function metricCard(label, value, copy) {
                return `
                  <article class="mini-card">
                    <div class="metric-label">${label}</div>
                    <div class="metric-value">${value}</div>
                    <div class="metric-copy">${copy}</div>
                  </article>
                `;
              }

              function statusBadge(enabled, status) {
                const tone = enabled && status === 'active' ? 'success' : (!enabled || status === 'invalid' ? 'error' : '');
                const label = `${enabled ? 'Enabled' : 'Disabled'} · ${status}`;
                return `<span class="status-pill"><span class="status-dot ${tone}"></span>${label}</span>`;
              }

              function accountCard(account) {
                return `
                  <article class="account-card">
                    <div class="account-card-header">
                      <div>
                        <h3 class="account-card-title">${account.name || account.email || account.user_id || 'Unnamed account'}</h3>
                        <div class="account-meta">${account.email || account.user_id || 'No identity available'}</div>
                      </div>
                      ${statusBadge(account.enabled, account.status)}
                    </div>
                    <div class="detail-list">
                      <div class="detail-row"><span class="metric-label">JWT</span><code>${account.masked_jwt || '—'}</code></div>
                      <div class="detail-row"><span class="metric-label">Session</span><code>${account.masked_session_token || '—'}</code></div>
                      <div class="detail-row"><span class="metric-label">Checked</span><div class="muted-copy">${formatTimestamp(account.last_checked_at)}</div></div>
                      <div class="detail-row"><span class="metric-label">Failures</span><div class="muted-copy">${account.failure_count}</div></div>
                      <div class="detail-row"><span class="metric-label">Last error</span><div class="muted-copy">${account.last_error || 'None'}</div></div>
                    </div>
                    <div class="account-actions">
                      <button class="secondary-button" data-action="check-account" data-account-id="${account.id}">Check</button>
                      <button class="${account.enabled ? 'danger-button' : 'ghost-button'}" data-action="toggle-account" data-account-id="${account.id}" data-enabled="${account.enabled ? '1' : '0'}">${account.enabled ? 'Disable' : 'Enable'}</button>
                    </div>
                  </article>
                `;
              }

              function logCard(log) {
                const tone = log.level === 'warning' ? 'warn' : (log.level === 'error' ? 'error' : 'success');
                return `
                  <article class="log-card">
                    <div class="log-card-header">
                      <div>
                        <div class="metric-label">${log.category}</div>
                        <h3 class="log-card-title">${log.message}</h3>
                      </div>
                      <span class="status-pill"><span class="status-dot ${tone === 'success' ? 'success' : tone === 'error' ? 'error' : ''}"></span>${log.level}</span>
                    </div>
                    <div class="log-meta">${formatTimestamp(log.created_at)}</div>
                    <div class="log-details">${log.details ? JSON.stringify(log.details, null, 2) : 'No details'}</div>
                  </article>
                `;
              }

              function overviewView() {
                const bootstrap = state.bootstrap || {};
                const accounts = state.accounts || [];
                const security = state.security || bootstrap;
                const logs = state.logs || [];
                const panelPassword = (security.panel_password || bootstrap.panel_password || {});
                const apiPassword = (security.api_password || bootstrap.api_password || {});
                const summary = bootstrap.accounts || {};
                const defaultBanner = panelPassword.default_password_active
                  ? '<div class="banner warn">Panel password is currently using the default fallback <strong>123456</strong>. Change it now from the Security page.</div>'
                  : '';
                return `
                  <section class="hero">
                    <article class="hero-card">
                      <div class="hero-kicker">Operational Snapshot</div>
                      <h2 class="hero-title">Account routing is online and ready for live control.</h2>
                      <p class="hero-text">
                        All critical backend actions are now connected. You can register JWT credentials, rotate passwords,
                        and inspect audit events directly from this console.
                      </p>
                      ${defaultBanner}
                      <div class="stats-grid">
                        ${metricCard('Persisted accounts', summary.persisted_total ?? 0, 'Accounts currently stored in SQLite.')}
                        ${metricCard('Enabled accounts', summary.persisted_enabled ?? 0, 'Accounts available for routing right now.')}
                        ${metricCard('API auth', apiPassword.enabled ? 'On' : 'Off', apiPassword.enabled ? 'API requests currently require the configured password.' : 'API requests are currently open because no API password is active.')}
                        ${metricCard('Recent logs', logs.length, 'Entries loaded into the current frontend session.')}
                      </div>
                    </article>
                    <article class="hero-card">
                      <div class="metric-label">Readiness summary</div>
                      ${statusBadge(Boolean(summary.persisted_enabled), summary.using_env_fallback ? 'env-fallback' : 'pool')}
                      <div class="muted-copy">Active panel password source: <strong>${panelPassword.source || 'unknown'}</strong>.</div>
                      <div class="muted-copy">API password source: <strong>${apiPassword.source || 'disabled'}</strong>.</div>
                      <div class="muted-copy">Loaded accounts in current view cache: <strong>${accounts.length}</strong>.</div>
                      <div class="banner info">Use the sidebar to switch between account, security, and log workflows without leaving the current session.</div>
                    </article>
                  </section>
                  <section class="view-card">
                    <div class="view-header">
                      <div>
                        <h2>Recent audit activity</h2>
                        <p class="muted-copy">The three latest audit entries are mirrored here for fast context.</p>
                      </div>
                    </div>
                    <div class="account-grid">
                      ${logs.slice(0, 3).map(logCard).join('') || '<div class="banner info">No logs loaded yet. Open the Logs page or press Refresh.</div>'}
                    </div>
                  </section>
                `;
              }

              function accountsView() {
                const accounts = state.accounts || [];
                return `
                  <section class="split-grid">
                    <article class="form-card">
                      <div class="view-header">
                        <div>
                          <h2>Add account</h2>
                          <p class="muted-copy">Paste a JWT. The backend will verify it, derive the session token, and persist the account.</p>
                        </div>
                        <span class="chip">Validation + persist</span>
                      </div>
                      <form id="add-account-form" class="field-group">
                        <label class="field-label" for="new-jwt">JWT credential</label>
                        <textarea class="field-textarea" id="new-jwt" placeholder="eyJhbGciOi..." required></textarea>
                        <div class="inline-actions">
                          <button class="primary-button" type="submit" id="add-account-submit">Verify and save</button>
                        </div>
                      </form>
                    </article>
                    <article class="view-card">
                      <div class="view-header">
                        <div>
                          <h2>Account pool</h2>
                          <p class="muted-copy">Enable, disable, or manually check any persisted account.</p>
                        </div>
                        <div class="toolbar">
                          <button class="ghost-button" data-action="reload-accounts">Reload accounts</button>
                          <span class="status-pill"><span class="status-dot ${accounts.length ? 'success' : ''}"></span>${accounts.length} loaded</span>
                        </div>
                      </div>
                      <div class="account-grid">
                        ${accounts.length ? accounts.map(accountCard).join('') : '<div class="banner info">No persisted accounts yet. Add the first JWT from the card on the left.</div>'}
                      </div>
                    </article>
                  </section>
                `;
              }

              function securityView() {
                const security = state.security || { panel_password: {}, api_password: {}, log_retention: {}, poll_interval_seconds: 0 };
                const panel = security.panel_password || {};
                const apiPassword = security.api_password || {};
                const logRetention = security.log_retention || {};
                return `
                  <section class="security-grid">
                    <article class="form-card">
                      <div class="view-header">
                        <div>
                          <h2>Panel password</h2>
                          <p class="muted-copy">Rotate the password used to unlock the admin surface.</p>
                        </div>
                        ${statusBadge(true, panel.source || 'unknown')}
                      </div>
                      <div class="banner ${panel.overridden_by_env ? 'warn' : 'info'}">
                        ${panel.overridden_by_env ? 'Env value currently overrides database state. Saved changes will not become effective until the env override is removed.' : 'Database-backed settings are active for panel login.'}
                      </div>
                      <form id="panel-password-form" class="field-group">
                        <label class="field-label" for="panel-password-next">New panel password</label>
                        <input class="field-input" id="panel-password-next" type="password" autocomplete="new-password" required />
                        <div class="inline-actions">
                          <button class="primary-button" type="submit">Update panel password</button>
                        </div>
                      </form>
                    </article>

                    <article class="form-card">
                      <div class="view-header">
                        <div>
                          <h2>API password</h2>
                          <p class="muted-copy">Control whether <code>/v1/*</code> requires a password and rotate that credential when needed.</p>
                        </div>
                        ${statusBadge(apiPassword.enabled, apiPassword.source || 'disabled')}
                      </div>
                      <div class="banner ${apiPassword.overridden_by_env ? 'warn' : 'info'}">
                        ${apiPassword.overridden_by_env ? 'Env value overrides the database-backed API password configuration.' : apiPassword.enabled ? 'API authentication is enabled.' : 'API authentication is currently disabled.'}
                      </div>
                      <form id="api-password-form" class="field-group">
                        <label class="field-label" for="api-password-next">New API password</label>
                        <input class="field-input" id="api-password-next" type="password" autocomplete="new-password" />
                        <div class="inline-actions">
                          <button class="primary-button" type="submit">Save API password</button>
                          <button class="ghost-button" type="button" data-action="disable-api-password">Disable API auth</button>
                        </div>
                      </form>
                      <div class="inline-card">
                        <div class="metric-label">Polling interval</div>
                        <div class="metric-value">${security.poll_interval_seconds ?? 0}s</div>
                        <div class="metric-copy">Configured background account health check interval.</div>
                      </div>
                    </article>

                    <article class="form-card">
                      <div class="view-header">
                        <div>
                          <h2>Log retention</h2>
                          <p class="muted-copy">Control how long audit logs are kept in SQLite before old entries are cleaned up.</p>
                        </div>
                        ${statusBadge(true, logRetention.source || 'default')}
                      </div>
                      <div class="banner ${logRetention.overridden_by_env ? 'warn' : logRetention.default_active ? 'info' : 'info'}">
                        ${logRetention.overridden_by_env
                          ? 'Env value currently overrides the database-backed log retention setting.'
                          : logRetention.default_active
                            ? 'No explicit retention override is set. The active default retention is 7 days.'
                            : 'Database-backed log retention is active.'}
                      </div>
                      <form id="log-retention-form" class="field-group">
                        <label class="field-label" for="log-retention-days">Retention days</label>
                        <input class="field-input" id="log-retention-days" type="number" min="1" step="1" value="${logRetention.days ?? 7}" required />
                        <div class="inline-actions">
                          <button class="primary-button" type="submit">Save retention</button>
                        </div>
                      </form>
                      <div class="inline-card">
                        <div class="metric-label">Current policy</div>
                        <div class="metric-value">${logRetention.days ?? 7}d</div>
                        <div class="metric-copy">Logs older than this window will be removed automatically.</div>
                      </div>
                    </article>
                  </section>
                `;
              }

              function logsView() {
                const logs = state.logs || [];
                return `
                  <section class="view-card">
                    <div class="view-header">
                      <div>
                        <h2>Audit logs</h2>
                        <p class="muted-copy">Review account operations, security changes, and warnings emitted by the backend.</p>
                      </div>
                      <div class="toolbar">
                        <button class="ghost-button" data-action="reload-logs">Refresh logs</button>
                        <span class="status-pill"><span class="status-dot ${logs.length ? 'success' : ''}"></span>${logs.length} loaded</span>
                      </div>
                    </div>
                    <div class="account-grid">
                      ${logs.length ? logs.map(logCard).join('') : '<div class="banner info">No audit entries loaded yet. Press Refresh to try again.</div>'}
                    </div>
                  </section>
                `;
              }

              function renderContent() {
                if (state.currentView === 'overview') return overviewView();
                if (state.currentView === 'accounts') return accountsView();
                if (state.currentView === 'security') return securityView();
                return logsView();
              }

              function render() {
                renderNav();
                const bootstrap = state.bootstrap || {};
                const accounts = bootstrap.accounts || {};
                headlineTitle.textContent = state.loggedIn ? 'Control center online' : 'Authentication required';
                headlineCopy.textContent = state.loggedIn
                  ? 'The admin panel is connected to real backend workflows for account routing, security, and audit exploration.'
                  : 'Sign in to unlock account orchestration, security settings, and audit visibility.';
                sidebarPosture.textContent = state.loggedIn
                  ? `Persisted ${accounts.persisted_enabled ?? 0} / ${accounts.persisted_total ?? 0} accounts. ${accounts.using_env_fallback ? 'Env fallback is active.' : 'Persisted pool is active.'}`
                  : 'Panel is locked. Use the password gate to continue.';
                loginLayer.classList.toggle('hidden', state.loggedIn);
                logoutButton.classList.toggle('hidden', !state.loggedIn);
                contentRoot.innerHTML = state.loggedIn
                  ? renderContent()
                  : `
                    <section class="hero">
                      <article class="hero-card">
                        <div class="hero-kicker">Access control</div>
                        <h2 class="hero-title">This route is protected by the panel password.</h2>
                        <p class="hero-text">
                          Sign in from the acrylic gate to continue. The shell will immediately sync your latest backend posture once authenticated.
                        </p>
                      </article>
                      <article class="hero-card">
                        <div class="metric-label">Current defaults</div>
                        <div class="placeholder-copy">
                          If no env or database value exists, the panel password falls back to <strong>123456</strong> and the API password remains disabled.
                        </div>
                      </article>
                    </section>
                  `;
              }

              async function refreshBootstrap(showToastOnSuccess = false) {
                const response = await api('/api/admin/bootstrap', { headers: {} });
                state.bootstrap = response;
                state.loggedIn = Boolean(response.logged_in);
                loginHint.textContent = response.panel_password?.default_password_active
                  ? 'Default fallback password is active. Sign in and rotate it as soon as possible.'
                  : 'Use the active panel password to access the admin surface.';
                if (!state.loggedIn) {
                  state.accounts = null;
                  state.security = null;
                  state.logs = null;
                }
                render();
                if (showToastOnSuccess) {
                  showToast('Control plane refreshed.', 'success');
                }
              }

              async function ensureViewData(view = state.currentView) {
                if (!state.loggedIn) return;
                try {
                  if (view === 'overview' || view === 'accounts') {
                    state.loading.accounts = true;
                    const payload = await api('/api/admin/accounts', { headers: {} });
                    state.accounts = payload.accounts;
                  }
                  if (view === 'overview' || view === 'security') {
                    state.loading.security = true;
                    state.security = await api('/api/admin/settings/security', { headers: {} });
                  }
                  if (view === 'overview' || view === 'logs') {
                    state.loading.logs = true;
                    const payload = await api('/api/admin/logs?limit=50', { headers: {} });
                    state.logs = payload.logs;
                  }
                } finally {
                  state.loading.accounts = false;
                  state.loading.security = false;
                  state.loading.logs = false;
                  render();
                }
              }

              loginForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                loginError.classList.add('hidden');
                setTopBusy(true);
                try {
                  await api('/api/admin/login', {
                    method: 'POST',
                    body: JSON.stringify({ password: panelPassword.value }),
                  });
                  panelPassword.value = '';
                  showToast('Signed in successfully.', 'success');
                  await refreshBootstrap(false);
                  await ensureViewData('overview');
                } catch (error) {
                  loginError.textContent = error.message || 'Login failed.';
                  loginError.classList.remove('hidden');
                  showToast('Panel authentication failed.', 'error');
                } finally {
                  setTopBusy(false);
                }
              });

              navList.addEventListener('click', async (event) => {
                const target = event.target.closest('[data-view]');
                if (!target) return;
                state.currentView = target.dataset.view;
                render();
                await ensureViewData(state.currentView);
              });

              contentRoot.addEventListener('submit', async (event) => {
                const form = event.target;
                if (!(form instanceof HTMLFormElement)) return;

                if (form.id === 'add-account-form') {
                  event.preventDefault();
                  const textarea = form.querySelector('#new-jwt');
                  const submit = form.querySelector('#add-account-submit');
                  const jwt = textarea.value.trim();
                  if (!jwt) {
                    showToast('JWT cannot be empty.', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  submit.textContent = 'Verifying...';
                  try {
                    await api('/api/admin/accounts', {
                      method: 'POST',
                      body: JSON.stringify({ jwt }),
                    });
                    textarea.value = '';
                    showToast('Account verified and stored.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('accounts');
                  } catch (error) {
                    showToast(error.message || 'Failed to add account.', 'error');
                  } finally {
                    submit.disabled = false;
                    submit.textContent = 'Verify and save';
                  }
                }

                if (form.id === 'panel-password-form') {
                  event.preventDefault();
                  const input = form.querySelector('#panel-password-next');
                  const submit = form.querySelector('button[type="submit"]');
                  const password = input.value.trim();
                  if (!password) {
                    showToast('Panel password cannot be empty.', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  try {
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ panel_password: password }),
                    });
                    input.value = '';
                    showToast('Panel password updated.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  } catch (error) {
                    showToast(error.message || 'Failed to update panel password.', 'error');
                  } finally {
                    submit.disabled = false;
                  }
                }

                if (form.id === 'api-password-form') {
                  event.preventDefault();
                  const input = form.querySelector('#api-password-next');
                  const submit = form.querySelector('button[type="submit"]');
                  const password = input.value.trim();
                  if (!password) {
                    showToast('API password cannot be empty.', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  try {
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ api_password: password }),
                    });
                    input.value = '';
                    showToast('API password updated.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  } catch (error) {
                    showToast(error.message || 'Failed to update API password.', 'error');
                  } finally {
                    submit.disabled = false;
                  }
                }

                if (form.id === 'log-retention-form') {
                  event.preventDefault();
                  const input = form.querySelector('#log-retention-days');
                  const submit = form.querySelector('button[type="submit"]');
                  const days = Number.parseInt(input.value, 10);
                  if (!Number.isFinite(days) || days < 1) {
                    showToast('Log retention days must be at least 1.', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  try {
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ log_retention_days: days }),
                    });
                    showToast('Log retention updated.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  } catch (error) {
                    showToast(error.message || 'Failed to update log retention.', 'error');
                  } finally {
                    submit.disabled = false;
                  }
                }
              });

              contentRoot.addEventListener('click', async (event) => {
                const button = event.target.closest('[data-action]');
                if (!button) return;
                const action = button.dataset.action;

                try {
                  if (action === 'reload-accounts') {
                    await ensureViewData('accounts');
                    showToast('Account list refreshed.', 'success');
                  }
                  if (action === 'reload-logs') {
                    await ensureViewData('logs');
                    showToast('Logs refreshed.', 'success');
                  }
                  if (action === 'disable-api-password') {
                    button.disabled = true;
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ disable_api_password: true }),
                    });
                    showToast('API password disabled.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  }
                  if (action === 'check-account') {
                    const accountId = button.dataset.accountId;
                    button.disabled = true;
                    await api(`/api/admin/accounts/${accountId}/check`, { method: 'POST' });
                    showToast('Account health check finished.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('accounts');
                  }
                  if (action === 'toggle-account') {
                    const accountId = button.dataset.accountId;
                    const enabled = button.dataset.enabled === '1';
                    button.disabled = true;
                    await api(`/api/admin/accounts/${accountId}/${enabled ? 'disable' : 'enable'}`, { method: 'POST' });
                    showToast(enabled ? 'Account disabled.' : 'Account enabled.', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('accounts');
                  }
                } catch (error) {
                  showToast(error.message || 'Action failed.', 'error');
                } finally {
                  button.disabled = false;
                }
              });

              refreshButton.addEventListener('click', async () => {
                setTopBusy(true);
                try {
                  await refreshBootstrap(true);
                  if (state.loggedIn) {
                    await ensureViewData(state.currentView);
                  }
                } finally {
                  setTopBusy(false);
                }
              });

              logoutButton.addEventListener('click', async () => {
                setTopBusy(true);
                try {
                  await api('/api/admin/logout', { method: 'POST' });
                  state.loggedIn = false;
                  state.currentView = 'overview';
                  showToast('Signed out.', 'success');
                  await refreshBootstrap(false);
                } catch (error) {
                  showToast(error.message || 'Failed to sign out.', 'error');
                } finally {
                  setTopBusy(false);
                }
              });

              (async () => {
                try {
                  await refreshBootstrap(false);
                  if (state.loggedIn) {
                    await ensureViewData('overview');
                  }
                } catch (error) {
                  console.error(error);
                  showToast('Failed to initialize control center.', 'error');
                }
              })();
            </script>
          </body>
        </html>
        """
    ).strip()
