import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api } from "../api/client.js";

@customElement("logs-page")
export class LogsPage extends LitElement {
  @state() private files: any[] = [];
  @state() private active = "";
  @state() private lines: string[] = [];
  @state() private totalSize = 0;
  @state() private loading = false;
  @state() private refreshing = false;
  @state() private error = "";

  static styles = css`
    :host { display: block; }

    .page-header {
      display: flex; align-items: center; gap: 14px; margin-bottom: 20px;
    }
    h1 {
      font-size: 24px; font-weight: 700; color: var(--text-primary);
      letter-spacing: -0.5px; margin: 0;
    }
    .refresh-btn {
      width: 34px; height: 34px; display: flex;
      align-items: center; justify-content: center;
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); color: var(--text-secondary);
      cursor: pointer; font-size: 15px;
      transition: all 0.2s var(--ease);
    }
    .refresh-btn:hover { color: var(--green); border-color: var(--green); background: var(--green-glow); }
    .refresh-btn.spinning { animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Tab switcher */
    .tabs {
      display: flex; gap: 4px; margin-bottom: 18px;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-md); padding: 4px;
      width: fit-content;
    }
    .tab {
      padding: 7px 16px; font-size: 13px; font-weight: 500;
      border-radius: var(--r-sm); cursor: pointer;
      color: var(--text-secondary); background: none; border: none;
      transition: all 0.15s var(--ease); font-family: var(--font-sans);
      display: flex; align-items: center; gap: 8px;
    }
    .tab:hover { color: var(--text-primary); background: var(--bg-hover); }
    .tab.active {
      color: var(--green); background: var(--green-soft); font-weight: 600;
    }
    .tab .size {
      font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);
    }

    /* Log viewer */
    .log-card {
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); box-shadow: var(--shadow-card);
      overflow: hidden; display: flex; flex-direction: column;
    }
    .log-toolbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 12px 18px; border-bottom: 1px solid var(--border-subtle);
    }
    .log-filename {
      font-size: 13px; font-weight: 600; color: var(--text-primary);
      font-family: var(--font-mono);
    }
    .log-meta {
      font-size: 11px; color: var(--text-muted); display: flex; gap: 16px;
    }
    .log-content {
      padding: 16px 18px;
      font-size: 12px; line-height: 1.7;
      max-height: calc(100vh - 240px); overflow-y: auto;
      white-space: pre-wrap; word-break: break-all;
      color: var(--text-secondary); font-family: var(--font-mono);
      background: var(--bg-input);
    }

    .empty {
      padding: 48px; text-align: center; color: var(--text-muted); font-size: 14px;
    }
    .error { color: var(--red); padding: 12px; }

    @media (max-width: 768px) {
      h1 { font-size: 20px; }
      .tabs { overflow-x: auto; flex-wrap: nowrap; width: auto; }
      .tab { white-space: nowrap; flex-shrink: 0; }
      .log-content { padding: 12px 14px; font-size: 11px; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadFiles();
  }

  private async refresh() {
    this.refreshing = true;
    await this.loadFiles();
    if (this.active) await this.loadLog(this.active);
    this.refreshing = false;
  }

  private async loadFiles() {
    try {
      const res = await api.getLogFiles();
      this.files = res.files || [];
      if (this.files.length && !this.active) {
        this.active = this.files[0].name;
        this.loadLog(this.active);
      }
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private async loadLog(name: string) {
    this.active = name;
    this.loading = true;
    try {
      const res = await api.getLogFile(name);
      this.lines = res.lines || [];
      this.totalSize = res.totalSize || 0;
    } catch (e: any) {
      this.error = e.message;
      this.lines = [];
    } finally {
      this.loading = false;
      await this.updateComplete;
      // Auto-scroll to bottom
      const el = this.shadowRoot?.querySelector(".log-content");
      if (el) el.scrollTop = el.scrollHeight;
      window.dispatchEvent(new CustomEvent("dashboard-file-select", {
        detail: { path: `logs/${name}` },
      }));
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.dispatchEvent(new CustomEvent("dashboard-file-select", {
      detail: { path: null },
    }));
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  render() {
    if (this.error && !this.files.length) return html`<div class="error">${this.error}</div>`;

    return html`
      <div class="page-header">
        <h1>Logs</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="Refresh">&#x21bb;</button>
      </div>

      ${this.files.length === 0
        ? html`<div class="empty">No .log files found</div>`
        : html`
          <div class="tabs">
            ${this.files.map(f => html`
              <button
                class="tab ${f.name === this.active ? "active" : ""}"
                @click=${() => this.loadLog(f.name)}
              >
                ${f.name}
                <span class="size">${this.formatSize(f.size)}</span>
              </button>
            `)}
          </div>

          <div class="log-card">
            <div class="log-toolbar">
              <span class="log-filename">${this.active}</span>
              <div class="log-meta">
                <span>${this.lines.length} lines</span>
                <span>${this.formatSize(this.totalSize)}</span>
              </div>
            </div>
            <div class="log-content">${
              this.loading
                ? "Loading..."
                : this.lines.length
                  ? this.lines.join("\n")
                  : "Empty log file"
            }</div>
          </div>
        `}
    `;
  }
}
