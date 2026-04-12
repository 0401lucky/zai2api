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
            <title>zai2api 控制台</title>
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

              .detail-row code {
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

              .log-stream {
                display: grid;
                gap: 10px;
              }

              .log-row {
                border: 1px solid var(--line);
                border-radius: 18px;
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(244, 248, 255, 0.92));
                overflow: hidden;
                transition: 160ms ease;
              }

              .log-row:hover {
                border-color: var(--line-strong);
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(241, 247, 255, 0.96));
                transform: translateY(-1px);
              }

              .log-row[open] {
                background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(239, 246, 255, 0.96));
              }

              .log-row.success {
                box-shadow: inset 3px 0 0 rgba(31, 143, 99, 0.65);
              }

              .log-row.warn {
                box-shadow: inset 3px 0 0 rgba(183, 121, 31, 0.68);
              }

              .log-row.error {
                box-shadow: inset 3px 0 0 rgba(209, 67, 67, 0.68);
              }

              .log-summary {
                display: grid;
                grid-template-columns: minmax(120px, 148px) minmax(0, 1fr) auto;
                gap: 14px;
                align-items: center;
                padding: 14px 16px;
                cursor: pointer;
                list-style: none;
              }

              .log-summary::-webkit-details-marker {
                display: none;
              }

              .log-row.compact .log-summary {
                padding: 12px 14px;
              }

              .log-rail,
              .log-mainline {
                display: grid;
                gap: 4px;
                min-width: 0;
              }

              .log-level-chip {
                display: inline-flex;
                width: fit-content;
                align-items: center;
                gap: 6px;
                padding: 5px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                border: 1px solid transparent;
              }

              .log-level-chip.success {
                color: var(--success);
                background: rgba(31, 143, 99, 0.1);
                border-color: rgba(31, 143, 99, 0.14);
              }

              .log-level-chip.warn {
                color: #8a6019;
                background: rgba(183, 121, 31, 0.1);
                border-color: rgba(183, 121, 31, 0.14);
              }

              .log-level-chip.error {
                color: #9c3535;
                background: rgba(209, 67, 67, 0.1);
                border-color: rgba(209, 67, 67, 0.14);
              }

              .log-time {
                color: var(--text-2);
                font-size: 12px;
                line-height: 1.4;
                font-family: "Cascadia Code", "Consolas", monospace;
              }

              .log-message {
                margin: 0;
                font-size: 15px;
                line-height: 1.45;
                font-weight: 700;
                color: var(--text-0);
              }

              .log-context {
                color: var(--text-2);
                font-size: 11px;
                line-height: 1.4;
                letter-spacing: 0.08em;
                text-transform: uppercase;
              }

              .log-toggle {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                color: var(--text-2);
                font-size: 12px;
                white-space: nowrap;
              }

              .log-caret {
                display: inline-block;
                transition: transform 160ms ease;
              }

              .log-row[open] .log-caret {
                transform: rotate(180deg);
              }

              .log-details,
              .log-empty {
                margin: 0 16px 16px;
                padding: 12px 14px;
                border-radius: 14px;
                border: 1px solid rgba(20, 56, 102, 0.08);
                background: rgba(239, 244, 253, 0.96);
                color: #31527c;
                font-family: "Cascadia Code", "Consolas", monospace;
                font-size: 12px;
                line-height: 1.6;
                white-space: pre-wrap;
                word-break: break-word;
                overflow-wrap: anywhere;
                overflow: auto;
              }

              .log-empty {
                color: var(--text-2);
                font-family: "Segoe UI Variable Text", "Segoe UI", "Noto Sans SC", system-ui, sans-serif;
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

                .log-summary {
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
                  <div class="brand-title">zai2api 控制台</div>
                  <div class="brand-copy">
                    面向账号调度、安全治理和运行态可视化的统一操作台。
                  </div>
                </div>

                <nav class="nav-list" id="nav-list"></nav>

                <div class="sidebar-footer">
                  <div class="metric-label">运行态概览</div>
                  <div class="muted-copy" id="sidebar-posture">
                    正在等待引导诊断结果。
                  </div>
                </div>
              </aside>

              <main class="panel main">
                <div class="topbar">
                  <div class="headline">
                    <h1 id="headline-title">正在准备控制台...</h1>
                    <p id="headline-copy">正在同步管理状态与安全态势。</p>
                  </div>
                  <div class="top-actions">
                    <button class="ghost-button" id="refresh-button">刷新</button>
                    <button class="secondary-button" id="logout-button">退出登录</button>
                  </div>
                </div>

                <section class="content" id="content-root"></section>
              </main>
            </div>

            <section class="login-layer hidden" id="login-layer">
              <form class="login-card" id="login-form">
                <div>
                  <div class="hero-kicker">管理员认证</div>
                </div>
                <div>
                  <h2 class="login-title">登录控制台</h2>
                  <p class="login-copy">
                    输入面板密码后即可进入账号调度、审计日志和安全控制界面。
                  </p>
                </div>
                <div class="banner info" id="login-hint"></div>
                <div class="field-group">
                  <label class="field-label" for="panel-password">面板密码</label>
                  <input class="field-input" id="panel-password" type="password" autocomplete="current-password" />
                  <div class="field-hint">如果环境变量和数据库都未配置密码，当前默认密码为 <strong>123456</strong>。</div>
                </div>
                <button class="primary-button" id="login-submit" type="submit">登录</button>
                <div class="banner error hidden" id="login-error"></div>
              </form>
            </section>

            <div class="toast-stack" id="toast-stack"></div>

            <script>
              const views = [
                { id: 'overview', label: '概览', meta: '实时态势' },
                { id: 'accounts', label: '账号', meta: '池管理' },
                { id: 'security', label: '安全', meta: '密码与策略' },
                { id: 'logs', label: '日志', meta: '审计信号' },
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

              const accountStatusLabels = {
                active: '正常',
                invalid: '失效',
                disabled: '已停用',
              };

              const runtimeStatusLabels = {
                'env-fallback': '环境变量兜底',
                pool: '持久化账号池',
              };

              const sourceLabels = {
                env: '环境变量',
                database: '数据库',
                default: '默认值',
                disabled: '未启用',
                unknown: '未知',
              };

              const logLevelLabels = {
                info: '信息',
                warning: '警告',
                error: '错误',
              };

              const logCategoryLabels = {
                startup: '启动',
                admin_auth: '面板认证',
                settings: '安全设置',
                requests: '请求',
                accounts: '账号',
                api_auth: 'API 认证',
              };

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
                loginSubmit.textContent = flag ? '登录中...' : '登录';
              }

              function formatTimestamp(value) {
                if (!value) return '—';
                const date = new Date(value * 1000);
                return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('zh-CN');
              }

              async function api(path, options = {}) {
                const response = await fetch(path, {
                  credentials: 'same-origin',
                  headers: { 'content-type': 'application/json', ...(options.headers || {}) },
                  ...options,
                });
                const payload = await response.json().catch(() => ({}));
                if (!response.ok) {
                  throw new Error(payload.detail || '请求失败');
                }
                return payload;
              }

              function displayLabel(labels, value, fallback = '未知') {
                if (!value) return fallback;
                return labels[value] || value;
              }

              function renderPill(label, tone = '') {
                return `<span class="status-pill"><span class="status-dot ${tone}"></span>${label}</span>`;
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

              function accountStatusBadge(enabled, status) {
                const tone = enabled && status === 'active' ? 'success' : (!enabled || status === 'invalid' ? 'error' : '');
                const label = `${enabled ? '已启用' : '已停用'} · ${displayLabel(accountStatusLabels, status)}`;
                return renderPill(label, tone);
              }

              function runtimeModeBadge(summary) {
                if (summary.using_env_fallback) {
                  return renderPill(`运行模式 · ${displayLabel(runtimeStatusLabels, 'env-fallback')}`);
                }
                const tone = summary.persisted_enabled ? 'success' : 'error';
                return renderPill(`运行模式 · ${displayLabel(runtimeStatusLabels, 'pool')}`, tone);
              }

              function sourceBadge(source, enabled = true) {
                const tone = source === 'disabled' ? 'error' : (enabled ? 'success' : '');
                return renderPill(`来源 · ${displayLabel(sourceLabels, source)}`, tone);
              }

              function accountCard(account) {
                return `
                  <article class="account-card">
                    <div class="account-card-header">
                      <div>
                        <h3 class="account-card-title">${account.name || account.email || account.user_id || '未命名账号'}</h3>
                        <div class="account-meta">${account.email || account.user_id || '暂无身份信息'}</div>
                      </div>
                      ${accountStatusBadge(account.enabled, account.status)}
                    </div>
                    <div class="detail-list">
                      <div class="detail-row"><span class="metric-label">JWT</span><code>${account.masked_jwt || '—'}</code></div>
                      <div class="detail-row"><span class="metric-label">会话</span><code>${account.masked_session_token || '—'}</code></div>
                      <div class="detail-row"><span class="metric-label">最近检查</span><div class="muted-copy">${formatTimestamp(account.last_checked_at)}</div></div>
                      <div class="detail-row"><span class="metric-label">失败次数</span><div class="muted-copy">${account.failure_count}</div></div>
                      <div class="detail-row"><span class="metric-label">最近错误</span><div class="muted-copy">${account.last_error || '无'}</div></div>
                    </div>
                    <div class="account-actions">
                      <button class="secondary-button" data-action="check-account" data-account-id="${account.id}">检测</button>
                      <button class="${account.enabled ? 'danger-button' : 'ghost-button'}" data-action="toggle-account" data-account-id="${account.id}" data-enabled="${account.enabled ? '1' : '0'}">${account.enabled ? '禁用' : '启用'}</button>
                    </div>
                  </article>
                `;
              }

              function logRow(log, compact = false) {
                const tone = log.level === 'warning' ? 'warn' : (log.level === 'error' ? 'error' : 'success');
                const detailText = log.details ? JSON.stringify(log.details, null, 2) : '';
                return `
                  <details class="log-row ${tone} ${compact ? 'compact' : ''}">
                    <summary class="log-summary">
                      <div class="log-rail">
                        <span class="log-level-chip ${tone}">${displayLabel(logLevelLabels, log.level, log.level || '未知')}</span>
                        <span class="log-time">${formatTimestamp(log.created_at)}</span>
                      </div>
                      <div class="log-mainline">
                        <div class="log-message">${log.message}</div>
                        <div class="log-context">${displayLabel(logCategoryLabels, log.category, log.category || '未知')}</div>
                      </div>
                      <span class="log-toggle">查看详情 <span class="log-caret">▾</span></span>
                    </summary>
                    ${detailText ? `<div class="log-details">${detailText}</div>` : '<div class="log-empty">暂无详情</div>'}
                  </details>
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
                  ? '<div class="banner warn">当前面板密码仍在使用默认兜底值 <strong>123456</strong>。请立即前往“安全”页修改。</div>'
                  : '';
                return `
                  <section class="hero">
                    <article class="hero-card">
                      <div class="hero-kicker">运行快照</div>
                      <h2 class="hero-title">账号路由已上线，可直接进入实战控制。</h2>
                      <p class="hero-text">
                        现在可以直接在这个控制台里完成 JWT 注册、密码轮换和审计事件排查，
                        关键后端链路已经全部接通。
                      </p>
                      ${defaultBanner}
                      <div class="stats-grid">
                        ${metricCard('已持久化账号', summary.persisted_total ?? 0, '当前已存入 SQLite 的账号数量。')}
                        ${metricCard('已启用账号', summary.persisted_enabled ?? 0, '当前可参与路由的账号数量。')}
                        ${metricCard('API 认证', apiPassword.enabled ? '开启' : '关闭', apiPassword.enabled ? '当前调用 API 需要提供已配置的密码。' : '当前 API 处于开放状态，因为尚未启用 API 密码。')}
                        ${metricCard('最近日志', logs.length, '本次前端会话中已加载的审计条目数。')}
                      </div>
                    </article>
                    <article class="hero-card">
                      <div class="metric-label">就绪摘要</div>
                      ${runtimeModeBadge(summary)}
                      <div class="muted-copy">当前面板密码来源：<strong>${displayLabel(sourceLabels, panelPassword.source)}</strong>。</div>
                      <div class="muted-copy">当前 API 密码来源：<strong>${displayLabel(sourceLabels, apiPassword.source)}</strong>。</div>
                      <div class="muted-copy">当前视图缓存中的账号数：<strong>${accounts.length}</strong>。</div>
                      <div class="banner info">左侧导航可以在账号、安全和日志工作流之间快速切换，无需离开当前会话。</div>
                    </article>
                  </section>
                  <section class="view-card">
                    <div class="view-header">
                      <div>
                        <h2>最近审计活动</h2>
                        <p class="muted-copy">这里会同步展示最近三条审计记录，便于快速判断当前状态。</p>
                      </div>
                    </div>
                    <div class="log-stream">
                      ${logs.slice(0, 3).map((log) => logRow(log, true)).join('') || '<div class="banner info">暂未加载日志。可进入“日志”页，或点击右上角“刷新”。</div>'}
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
                          <h2>添加账号</h2>
                          <p class="muted-copy">粘贴 JWT 后，后端会自动校验、换取会话令牌并持久化保存该账号。</p>
                        </div>
                        <span class="chip">校验并持久化</span>
                      </div>
                      <form id="add-account-form" class="field-group">
                        <label class="field-label" for="new-jwt">JWT 凭证</label>
                        <textarea class="field-textarea" id="new-jwt" placeholder="eyJhbGciOi..." required></textarea>
                        <div class="inline-actions">
                          <button class="primary-button" type="submit" id="add-account-submit">校验并保存</button>
                        </div>
                      </form>
                    </article>
                    <article class="view-card">
                      <div class="view-header">
                        <div>
                          <h2>账号池</h2>
                          <p class="muted-copy">可以对任意已持久化账号执行启用、禁用或手动健康检查。</p>
                        </div>
                        <div class="toolbar">
                          <button class="ghost-button" data-action="reload-accounts">刷新账号</button>
                          ${renderPill(`已加载 ${accounts.length} 个账号`, accounts.length ? 'success' : '')}
                        </div>
                      </div>
                      <div class="account-grid">
                        ${accounts.length ? accounts.map(accountCard).join('') : '<div class="banner info">暂时还没有持久化账号，请先在左侧卡片中添加第一条 JWT。</div>'}
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
                          <h2>面板密码</h2>
                          <p class="muted-copy">修改用于进入管理面的登录密码。</p>
                        </div>
                        ${sourceBadge(panel.source || 'unknown')}
                      </div>
                      <div class="banner ${panel.overridden_by_env ? 'warn' : 'info'}">
                        ${panel.overridden_by_env ? '当前环境变量会覆盖数据库里的面板密码配置。只有移除环境变量覆盖后，已保存的新值才会生效。' : '当前面板登录正在使用数据库中的密码配置。'}
                      </div>
                      <form id="panel-password-form" class="field-group">
                        <label class="field-label" for="panel-password-next">新的面板密码</label>
                        <input class="field-input" id="panel-password-next" type="password" autocomplete="new-password" required />
                        <div class="inline-actions">
                          <button class="primary-button" type="submit">更新面板密码</button>
                        </div>
                      </form>
                    </article>

                    <article class="form-card">
                      <div class="view-header">
                        <div>
                          <h2>API 密码</h2>
                          <p class="muted-copy">控制 <code>/v1/*</code> 是否需要密码，并在需要时轮换这项凭证。</p>
                        </div>
                        ${sourceBadge(apiPassword.source || 'disabled', apiPassword.enabled)}
                      </div>
                      <div class="banner ${apiPassword.overridden_by_env ? 'warn' : 'info'}">
                        ${apiPassword.overridden_by_env ? '当前环境变量会覆盖数据库中的 API 密码配置。' : apiPassword.enabled ? '当前已启用 API 密码认证。' : '当前未启用 API 密码认证。'}
                      </div>
                      <form id="api-password-form" class="field-group">
                        <label class="field-label" for="api-password-next">新的 API 密码</label>
                        <input class="field-input" id="api-password-next" type="password" autocomplete="new-password" />
                        <div class="inline-actions">
                          <button class="primary-button" type="submit">保存 API 密码</button>
                          <button class="ghost-button" type="button" data-action="disable-api-password">关闭 API 认证</button>
                        </div>
                      </form>
                      <div class="inline-card">
                        <div class="metric-label">轮询间隔</div>
                        <div class="metric-value">${security.poll_interval_seconds ?? 0}s</div>
                        <div class="metric-copy">后台账号健康检查的配置间隔。</div>
                      </div>
                    </article>

                    <article class="form-card">
                      <div class="view-header">
                        <div>
                          <h2>日志保留</h2>
                          <p class="muted-copy">控制审计日志在 SQLite 中保留多久，超过窗口的旧记录会被自动清理。</p>
                        </div>
                        ${sourceBadge(logRetention.source || 'default')}
                      </div>
                      <div class="banner ${logRetention.overridden_by_env ? 'warn' : logRetention.default_active ? 'info' : 'info'}">
                        ${logRetention.overridden_by_env
                          ? '当前环境变量会覆盖数据库中的日志保留配置。'
                          : logRetention.default_active
                            ? '当前没有显式覆盖项，正在使用默认的 7 天保留策略。'
                            : '当前正在使用数据库中的日志保留配置。'}
                      </div>
                      <form id="log-retention-form" class="field-group">
                        <label class="field-label" for="log-retention-days">保留天数</label>
                        <input class="field-input" id="log-retention-days" type="number" min="1" step="1" value="${logRetention.days ?? 7}" required />
                        <div class="inline-actions">
                          <button class="primary-button" type="submit">保存保留策略</button>
                        </div>
                      </form>
                      <div class="inline-card">
                        <div class="metric-label">当前策略</div>
                        <div class="metric-value">${logRetention.days ?? 7}d</div>
                        <div class="metric-copy">超过这个时间窗口的日志会被自动清理。</div>
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
                        <h2>审计日志</h2>
                        <p class="muted-copy">默认只展示时间、等级和事件标题，点开某一行时再查看完整上下文。</p>
                      </div>
                      <div class="toolbar">
                        <button class="ghost-button" data-action="reload-logs">刷新日志</button>
                        ${renderPill(`已加载 ${logs.length} 条日志`, logs.length ? 'success' : '')}
                      </div>
                    </div>
                    <div class="log-stream">
                      ${logs.length ? logs.map((log) => logRow(log)).join('') : '<div class="banner info">暂未加载审计记录，请点击“刷新日志”重试。</div>'}
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
                headlineTitle.textContent = state.loggedIn ? '控制台已就绪' : '需要身份验证';
                headlineCopy.textContent = state.loggedIn
                  ? '管理面已连接真实后端流程，可直接进行账号路由、安全配置和审计排查。'
                  : '登录后即可解锁账号编排、安全设置和审计可见性。';
                sidebarPosture.textContent = state.loggedIn
                  ? `已启用 ${accounts.persisted_enabled ?? 0} / ${accounts.persisted_total ?? 0} 个持久化账号。${accounts.using_env_fallback ? '当前正在使用环境变量兜底。' : '当前正在使用持久化账号池。'}`
                  : '控制台已锁定，请先输入面板密码。';
                loginLayer.classList.toggle('hidden', state.loggedIn);
                logoutButton.classList.toggle('hidden', !state.loggedIn);
                contentRoot.innerHTML = state.loggedIn
                  ? renderContent()
                  : `
                    <section class="hero">
                      <article class="hero-card">
                        <div class="hero-kicker">访问控制</div>
                        <h2 class="hero-title">当前页面受面板密码保护。</h2>
                        <p class="hero-text">
                          请先通过上方登录层完成认证。认证成功后，页面会立即同步最新的后端状态。
                        </p>
                      </article>
                      <article class="hero-card">
                        <div class="metric-label">当前默认值</div>
                        <div class="placeholder-copy">
                          如果环境变量和数据库都没有配置值，面板密码会回退到 <strong>123456</strong>，同时 API 密码保持关闭状态。
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
                  ? '当前正在使用默认兜底密码，请登录后尽快完成修改。'
                  : '请输入当前生效的面板密码以进入管理面。';
                if (!state.loggedIn) {
                  state.accounts = null;
                  state.security = null;
                  state.logs = null;
                }
                render();
                if (showToastOnSuccess) {
                  showToast('控制台数据已刷新。', 'success');
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
                  showToast('登录成功。', 'success');
                  await refreshBootstrap(false);
                  await ensureViewData('overview');
                } catch (error) {
                  loginError.textContent = error.message || '登录失败。';
                  loginError.classList.remove('hidden');
                  showToast('面板认证失败。', 'error');
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
                    showToast('JWT 不能为空。', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  submit.textContent = '校验中...';
                  try {
                    await api('/api/admin/accounts', {
                      method: 'POST',
                      body: JSON.stringify({ jwt }),
                    });
                    textarea.value = '';
                    showToast('账号已校验并保存。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('accounts');
                  } catch (error) {
                    showToast(error.message || '添加账号失败。', 'error');
                  } finally {
                    submit.disabled = false;
                    submit.textContent = '校验并保存';
                  }
                }

                if (form.id === 'panel-password-form') {
                  event.preventDefault();
                  const input = form.querySelector('#panel-password-next');
                  const submit = form.querySelector('button[type="submit"]');
                  const password = input.value.trim();
                  if (!password) {
                    showToast('面板密码不能为空。', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  try {
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ panel_password: password }),
                    });
                    input.value = '';
                    showToast('面板密码已更新。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  } catch (error) {
                    showToast(error.message || '更新面板密码失败。', 'error');
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
                    showToast('API 密码不能为空。', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  try {
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ api_password: password }),
                    });
                    input.value = '';
                    showToast('API 密码已更新。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  } catch (error) {
                    showToast(error.message || '更新 API 密码失败。', 'error');
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
                    showToast('日志保留天数必须大于等于 1。', 'warn');
                    return;
                  }
                  submit.disabled = true;
                  try {
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ log_retention_days: days }),
                    });
                    showToast('日志保留策略已更新。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  } catch (error) {
                    showToast(error.message || '更新日志保留策略失败。', 'error');
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
                    showToast('账号列表已刷新。', 'success');
                  }
                  if (action === 'reload-logs') {
                    await ensureViewData('logs');
                    showToast('日志已刷新。', 'success');
                  }
                  if (action === 'disable-api-password') {
                    button.disabled = true;
                    await api('/api/admin/settings/security', {
                      method: 'POST',
                      body: JSON.stringify({ disable_api_password: true }),
                    });
                    showToast('API 密码认证已关闭。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('security');
                  }
                  if (action === 'check-account') {
                    const accountId = button.dataset.accountId;
                    button.disabled = true;
                    await api(`/api/admin/accounts/${accountId}/check`, { method: 'POST' });
                    showToast('账号健康检查已完成。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('accounts');
                  }
                  if (action === 'toggle-account') {
                    const accountId = button.dataset.accountId;
                    const enabled = button.dataset.enabled === '1';
                    button.disabled = true;
                    await api(`/api/admin/accounts/${accountId}/${enabled ? 'disable' : 'enable'}`, { method: 'POST' });
                    showToast(enabled ? '账号已禁用。' : '账号已启用。', 'success');
                    await refreshBootstrap(false);
                    await ensureViewData('accounts');
                  }
                } catch (error) {
                  showToast(error.message || '操作失败。', 'error');
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
                  showToast('已退出登录。', 'success');
                  await refreshBootstrap(false);
                } catch (error) {
                  showToast(error.message || '退出登录失败。', 'error');
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
                  showToast('初始化控制台失败。', 'error');
                }
              })();
            </script>
          </body>
        </html>
        """
    ).strip()
