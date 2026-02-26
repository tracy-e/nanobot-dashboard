import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api } from "../api/client.js";
import { highlightFile } from "../utils/markdown.js";
import hljsStyles from "highlight.js/styles/github-dark.css?inline";

@customElement("status-page")
export class StatusPage extends LitElement {
  @state() private data: any = null;
  @state() private config: any = null;
  @state() private error = "";
  @state() private refreshing = false;
  @state() private showConfigModal = false;
  @state() private configRaw = "";
  @state() private configSaving = false;
  @state() private configError = "";

  static styles = css`
    ${unsafeCSS(hljsStyles)}
    :host { display: flex; flex-direction: column; height: calc(100vh - 64px); }

    .page-header {
      display: flex; align-items: center; gap: 14px; margin-bottom: 28px;
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
    .refresh-btn:hover {
      color: var(--green); border-color: var(--green);
      background: var(--green-glow);
    }
    .refresh-btn.spinning { animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Grid */
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-bottom: 24px;
    }

    /* Card */
    .card {
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg);
      padding: 22px 24px;
      box-shadow: var(--shadow-card);
      transition: border-color 0.2s var(--ease);
    }
    .card:hover { border-color: var(--border-default); }
    .card.clickable { cursor: pointer; }
    .card.clickable:hover { border-color: var(--green-dim); }
    .card h3 {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
      color: var(--text-muted); margin-bottom: 14px; font-weight: 600;
    }

    /* Status badge */
    .status-badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 14px; border-radius: 20px;
      font-size: 13px; font-weight: 600;
    }
    .status-badge.running {
      background: var(--green-soft); color: var(--green);
    }
    .status-badge.stopped {
      background: var(--red-soft); color: var(--red);
    }
    .pulse-dot {
      width: 8px; height: 8px; border-radius: 50%;
      position: relative;
    }
    .pulse-dot.on { background: var(--green); }
    .pulse-dot.off { background: var(--red); }
    .pulse-dot.on::after {
      content: '';
      position: absolute; inset: -3px;
      border-radius: 50%;
      background: var(--green);
      opacity: 0;
      animation: pulse 2s ease-out infinite;
    }
    @keyframes pulse {
      0% { opacity: 0.5; transform: scale(0.8); }
      100% { opacity: 0; transform: scale(2); }
    }
    .pid-text {
      margin-top: 10px; font-size: 12px; color: var(--text-muted);
      font-family: var(--font-mono);
    }

    /* Model value */
    .model-value {
      font-size: 16px; font-weight: 600; color: var(--text-primary);
      word-break: break-all;
    }
    .compact-model {
      margin-top: 10px; font-size: 12px; color: var(--text-muted);
    }
    .compact-model span {
      color: var(--text-secondary); font-weight: 500;
    }

    /* Channels */
    .channel-list { display: flex; flex-wrap: wrap; gap: 8px; }
    .channel-tag {
      padding: 5px 12px; border-radius: 20px; font-size: 12px;
      font-weight: 500; background: var(--bg-elevated);
      border: 1px solid var(--border-subtle);
      transition: all 0.15s var(--ease);
    }
    .channel-tag.enabled {
      border-color: rgba(74, 222, 128, 0.25); color: var(--green);
      background: var(--green-glow);
    }
    .channel-tag.disabled { color: var(--text-muted); }

    /* Cron stat */
    .cron-value {
      font-size: 28px; font-weight: 800; color: var(--text-primary);
      letter-spacing: -1px;
    }
    .cron-value span {
      font-size: 14px; font-weight: 500; color: var(--text-muted);
      letter-spacing: 0;
    }

    /* Config */
    .section-title {
      font-size: 11px; text-transform: uppercase; letter-spacing: 1.2px;
      color: var(--text-muted); font-weight: 600; margin-bottom: 14px;
      margin-top: 28px;
    }
    .config-json {
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); overflow: hidden;
      box-shadow: var(--shadow-card);
      flex: 1; min-height: 0; display: flex; flex-direction: column;
    }
    .config-json pre {
      background: transparent; border: none;
      padding: 18px 20px; font-size: 12px; line-height: 1.7;
      flex: 1; overflow-y: auto; margin: 0;
    }
    .config-json code { font-family: var(--font-mono); }
    .error { color: var(--red); padding: 12px; }

    /* Config header */
    .config-header {
      display: flex; align-items: center; gap: 12px; margin-top: 28px; margin-bottom: 14px;
    }
    .config-header .section-title { margin: 0; }
    .edit-btn {
      padding: 4px 12px; font-size: 12px; font-weight: 500;
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); color: var(--text-secondary);
      cursor: pointer; transition: all 0.18s var(--ease);
      font-family: var(--font-sans);
    }
    .edit-btn:hover {
      color: var(--green); border-color: var(--green); background: var(--green-glow);
    }

    /* Modal overlay */
    .modal-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      animation: fadeIn 0.15s ease-out;
    }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    .modal {
      background: var(--bg-surface); border: 1px solid var(--border-default);
      border-radius: var(--r-lg); box-shadow: 0 24px 64px rgba(0,0,0,0.5);
      width: 720px; max-width: 90vw; height: 80vh;
      display: flex; flex-direction: column;
      animation: slideUp 0.2s ease-out;
    }
    @keyframes slideUp { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

    .modal-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 18px 24px; border-bottom: 1px solid var(--border-subtle);
    }
    .modal-header h2 {
      font-size: 16px; font-weight: 700; color: var(--text-primary); margin: 0;
    }
    .modal-close {
      width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;
      background: none; border: 1px solid var(--border-subtle); border-radius: var(--r-sm);
      color: var(--text-muted); cursor: pointer; font-size: 16px;
      transition: all 0.15s var(--ease);
    }
    .modal-close:hover { color: var(--text-primary); border-color: var(--border-default); }

    .modal-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
    .modal-body textarea {
      flex: 1; min-height: 400px; resize: none;
      background: var(--bg-input); color: var(--text-primary);
      border: none; padding: 18px 20px;
      font-family: var(--font-mono); font-size: 12.5px; line-height: 1.7;
      tab-size: 2; outline: none;
    }

    .modal-footer {
      display: flex; align-items: center; justify-content: flex-end; gap: 10px;
      padding: 14px 24px; border-top: 1px solid var(--border-subtle);
    }
    .modal-footer .config-err {
      flex: 1; font-size: 12px; color: var(--red); font-family: var(--font-mono);
    }
    .modal-btn {
      padding: 7px 18px; font-size: 13px; font-weight: 600;
      border-radius: var(--r-sm); cursor: pointer;
      transition: all 0.15s var(--ease); font-family: var(--font-sans);
    }
    .modal-btn.cancel {
      background: var(--bg-card); border: 1px solid var(--border-default);
      color: var(--text-secondary);
    }
    .modal-btn.cancel:hover { color: var(--text-primary); }
    .modal-btn.save {
      background: var(--green); border: 1px solid var(--green);
      color: #000; font-weight: 700;
    }
    .modal-btn.save:hover { background: #5ee898; }
    .modal-btn.save:disabled { opacity: 0.5; cursor: not-allowed; }

    @media (max-width: 768px) {
      h1 { font-size: 20px; }
      .grid { grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
      .card { padding: 16px 18px; }
      .modal { width: 95vw; height: 85vh; }
      .modal-body textarea { min-height: 200px; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async refresh() {
    this.refreshing = true;
    await this.load();
    this.refreshing = false;
  }

  async load() {
    try {
      const [status, config, skills, memFiles] = await Promise.all([
        api.getStatus(),
        api.getConfig(),
        api.getSkills(),
        api.getMemoryFiles(),
      ]);
      this.data = status;
      this.data.skillsCount = skills.skills?.length || 0;
      const knowledgeFiles = (memFiles.files || []).filter((f: any) => f.group === "knowledge");
      this.data.knowledgeCount = knowledgeFiles.length;
      this.config = config;
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private _navigate(page: string) {
    location.hash = page;
  }

  private async openConfigEditor() {
    try {
      const raw = await api.getConfigRaw();
      this.configRaw = JSON.stringify(raw, null, 2);
      this.configError = "";
      this.showConfigModal = true;
    } catch (e: any) {
      this.configError = e.message;
    }
  }

  private async saveConfig() {
    this.configSaving = true;
    this.configError = "";
    try {
      await api.updateConfig(this.configRaw);
      this.showConfigModal = false;
      // Reload sanitized config for display
      this.config = await api.getConfig();
    } catch (e: any) {
      this.configError = e.message;
    } finally {
      this.configSaving = false;
    }
  }

  render() {
    if (this.error) return html`<div class="error">${this.error}</div>`;
    if (!this.data) return html`<div style="color:var(--text-muted)">Loading...</div>`;

    const d = this.data;
    const running = d.gateway?.running;

    return html`
      <div class="page-header">
        <h1>System Status</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="Refresh">&#x21bb;</button>
      </div>

      <div class="grid">
        <div class="card">
          <h3>Gateway</h3>
          <span class="status-badge ${running ? "running" : "stopped"}">
            <span class="pulse-dot ${running ? "on" : "off"}"></span>
            ${running ? "Running" : "Stopped"}
          </span>
          ${running && d.gateway.pids?.length
            ? html`<div class="pid-text">PID ${d.gateway.pids.join(", ")}</div>`
            : ""}
        </div>

        <div class="card">
          <h3>Model</h3>
          <div class="model-value">${d.model}</div>
          ${d.compactModel ? html`<div class="compact-model">Compact: <span>${d.compactModel}</span></div>` : ""}
        </div>

        <div class="card clickable" @click=${() => this._navigate("sessions")}>
          <h3>Channels</h3>
          <div class="channel-list">
            ${Object.entries(d.channels || {}).map(
              ([name, ch]: [string, any]) => html`
                <span class="channel-tag ${ch.enabled ? "enabled" : "disabled"}">
                  ${name}
                </span>
              `
            )}
          </div>
        </div>

        <div class="card clickable" @click=${() => this._navigate("cron")}>
          <h3>Cron Jobs</h3>
          <div class="cron-value">
            ${d.cron?.enabled}<span> / ${d.cron?.total} active</span>
          </div>
        </div>

        <div class="card clickable" @click=${() => this._navigate("skills")}>
          <h3>Skills</h3>
          <div class="cron-value">
            ${d.skillsCount}<span> installed</span>
          </div>
        </div>

        ${d.knowledgeCount ? html`
          <div class="card clickable" @click=${() => this._navigate("knowledge")}>
            <h3>Knowledge</h3>
            <div class="cron-value">
              ${d.knowledgeCount}<span> articles</span>
            </div>
          </div>
        ` : ""}
      </div>

      ${this.config
        ? html`
            <div class="config-header">
              <div class="section-title">Configuration (sanitized)</div>
              <button class="edit-btn" @click=${this.openConfigEditor}>Edit</button>
            </div>
            <div class="config-json">${unsafeHTML(highlightFile(JSON.stringify(this.config, null, 2), "json"))}</div>
          `
        : ""}

      ${this.showConfigModal ? html`
        <div class="modal-overlay" @click=${(e: Event) => { if (e.target === e.currentTarget) this.showConfigModal = false; }}>
          <div class="modal">
            <div class="modal-header">
              <h2>Edit config.json</h2>
              <button class="modal-close" @click=${() => this.showConfigModal = false}>&times;</button>
            </div>
            <div class="modal-body">
              <textarea
                .value=${this.configRaw}
                @input=${(e: Event) => this.configRaw = (e.target as HTMLTextAreaElement).value}
                spellcheck="false"
              ></textarea>
            </div>
            <div class="modal-footer">
              ${this.configError ? html`<div class="config-err">${this.configError}</div>` : ""}
              <button class="modal-btn cancel" @click=${() => this.showConfigModal = false}>Cancel</button>
              <button class="modal-btn save" ?disabled=${this.configSaving} @click=${this.saveConfig}>
                ${this.configSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }
}
