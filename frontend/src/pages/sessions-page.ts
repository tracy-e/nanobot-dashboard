import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api } from "../api/client.js";
import { renderMarkdown } from "../utils/markdown.js";
import hljsStyles from "highlight.js/styles/github-dark.css?inline";

@customElement("sessions-page")
export class SessionsPage extends LitElement {
  @state() private sessions: any[] = [];
  @state() private selected: any = null;
  @state() private messages: any[] = [];
  @state() private filter = "";
  @state() private error = "";
  @state() private loading = false;
  @state() private refreshing = false;
  @state() private note = "";
  @state() private editingNote = false;
  @state() private noteDraft = "";

  static styles = css`
    ${unsafeCSS(hljsStyles)}
    :host { display: block; }

    /* ---- Header ---- */
    .page-header {
      display: flex; align-items: center; gap: 14px; margin-bottom: 24px;
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

    .layout { display: flex; gap: 18px; height: calc(100vh - 110px); }

    /* ---- List Panel ---- */
    .list-panel {
      width: 310px; flex-shrink: 0; overflow-y: auto;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); box-shadow: var(--shadow-card);
      display: flex; flex-direction: column;
    }
    .filters {
      padding: 12px 14px; border-bottom: 1px solid var(--border-subtle);
      display: flex; gap: 6px; flex-wrap: wrap; flex-shrink: 0;
    }
    .filter-btn {
      padding: 4px 12px; border-radius: 20px; font-size: 11px;
      cursor: pointer; border: 1px solid var(--border-default);
      background: transparent; color: var(--text-muted);
      font-family: var(--font-sans); font-weight: 500;
      transition: all 0.18s var(--ease);
    }
    .filter-btn:hover { color: var(--text-secondary); border-color: var(--border-strong); }
    .filter-btn.active {
      background: var(--green-soft); color: var(--green);
      border-color: rgba(74,222,128,0.25);
    }
    .session-list { flex: 1; overflow-y: auto; }
    .group-header {
      padding: 10px 16px 5px; font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.8px;
      color: var(--text-muted); background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
      position: sticky; top: 0; z-index: 1;
    }
    .session-item {
      padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
      cursor: pointer; transition: all 0.15s var(--ease);
    }
    .session-item:hover { background: var(--bg-elevated); }
    .session-item.active {
      background: var(--bg-elevated);
      border-left: 3px solid var(--green);
    }
    .session-key {
      font-size: 13px; color: var(--text-primary); font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      display: flex; align-items: center; gap: 8px;
    }
    .session-meta {
      font-size: 11px; color: var(--text-muted); margin-top: 4px;
      display: flex; justify-content: space-between;
    }
    .channel-badge {
      display: inline-block; padding: 2px 8px; border-radius: 10px;
      font-size: 10px; font-weight: 600; letter-spacing: 0.3px;
    }
    .channel-badge.cli { background: var(--blue-soft); color: var(--blue); }
    .channel-badge.discord { background: var(--purple-soft); color: var(--purple); }
    .channel-badge.feishu { background: var(--green-soft); color: var(--green); }
    .channel-badge.cron { background: var(--orange-soft); color: var(--orange); }
    .channel-badge.heartbeat { background: rgba(236,72,153,0.10); color: #F472B6; }
    .channel-badge.t1 { background: var(--blue-soft); color: var(--blue); }
    .session-note {
      font-size: 11px; color: var(--orange); margin-top: 3px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }

    /* ---- Detail Panel ---- */
    .detail-panel {
      flex: 1; display: flex; flex-direction: column;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .detail-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .detail-header h2 {
      font-size: 14px; color: var(--text-primary); font-weight: 600; margin: 0;
    }
    .delete-btn {
      padding: 6px 14px; background: transparent; color: var(--red);
      border: 1px solid var(--red-soft); border-radius: var(--r-sm);
      cursor: pointer; font-size: 12px; font-weight: 500;
      font-family: var(--font-sans); transition: all 0.15s var(--ease);
    }
    .delete-btn:hover { background: var(--red-soft); }

    /* ---- Note bar ---- */
    .note-bar {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 20px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .note-label { font-size: 11px; color: var(--text-muted); flex-shrink: 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .note-text {
      font-size: 12px; color: var(--text-secondary); flex: 1;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      cursor: pointer;
    }
    .note-placeholder { color: var(--text-muted); font-style: italic; }
    .note-input {
      flex: 1; background: var(--bg-input); border: 1px solid var(--border-default);
      border-radius: 6px; padding: 5px 10px; color: var(--text-primary);
      font-size: 12px; font-family: var(--font-sans);
    }
    .note-input:focus { outline: none; border-color: var(--green); }
    .note-btn {
      padding: 4px 10px; border-radius: 6px; font-size: 11px;
      cursor: pointer; border: 1px solid var(--border-default);
      background: transparent; color: var(--text-muted);
      font-family: var(--font-sans); font-weight: 500; flex-shrink: 0;
      transition: all 0.15s var(--ease);
    }
    .note-btn:hover { color: var(--text-secondary); border-color: var(--border-strong); }
    .note-btn-save { color: var(--green); border-color: rgba(74,222,128,0.25); }
    .note-btn-save:hover { background: var(--green-glow); }

    /* ---- Messages ---- */
    .messages-container {
      flex: 1; overflow-y: auto; padding: 20px 24px;
      display: flex; flex-direction: column; gap: 6px;
    }
    .empty { color: var(--text-muted); text-align: center; padding: 48px; font-size: 13px; }
    .error { color: var(--red); margin-bottom: 12px; }

    .msg-row { display: flex; flex-direction: column; margin-bottom: 3px; }
    .msg-row.user { align-items: flex-end; }
    .msg-row.assistant { align-items: flex-start; }
    .msg-bubble {
      padding: 10px 16px; border-radius: var(--r-md);
      font-size: 13px; line-height: 1.65; max-width: 75%; word-break: break-word;
    }
    .msg-row.user .msg-bubble {
      background: linear-gradient(135deg, #1A365D, #1E3A5F);
      color: #DBEAFE; border-bottom-right-radius: 4px;
      border: 1px solid rgba(96, 165, 250, 0.12);
    }
    .msg-row.assistant .msg-bubble {
      background: var(--bg-elevated); color: var(--text-secondary);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--border-subtle);
    }
    .msg-row.assistant .msg-bubble.tool-msg {
      background: var(--bg-surface); border: 1px solid var(--border-subtle);
      font-size: 12px; color: var(--text-muted); max-width: 85%;
    }

    /* Markdown in bubbles */
    .md-content h1 { font-size: 17px; color: var(--text-primary); margin: 12px 0 6px; }
    .md-content h2 { font-size: 15px; color: var(--text-primary); margin: 10px 0 5px; }
    .md-content h3 { font-size: 14px; color: var(--text-primary); margin: 8px 0 4px; }
    .md-content p { margin: 4px 0; }
    .md-content p:first-child { margin-top: 0; }
    .md-content p:last-child { margin-bottom: 0; }
    .md-content a { color: var(--blue); text-decoration: none; }
    .md-content a:hover { text-decoration: underline; }
    .md-content ul, .md-content ol { padding-left: 20px; margin: 4px 0; }
    .md-content li { margin: 2px 0; }
    .md-content pre {
      background: var(--bg-input); border: 1px solid var(--border-subtle);
      border-radius: var(--r-sm); padding: 10px;
      overflow-x: auto; margin: 6px 0; font-size: 12px; line-height: 1.5;
    }
    .md-content code { font-family: var(--font-mono); }
    .md-content :not(pre) > code {
      background: var(--bg-hover); padding: 1px 5px; border-radius: 4px;
      font-size: 11px; color: var(--text-primary);
    }
    .msg-row.user .md-content :not(pre) > code {
      background: rgba(255,255,255,0.12); color: #DBEAFE;
    }
    .msg-row.user .md-content pre {
      background: rgba(0,0,0,0.25); border-color: rgba(255,255,255,0.08);
    }
    .msg-row.user .md-content a { color: #93C5FD; }
    .md-content table { border-collapse: collapse; margin: 6px 0; width: 100%; }
    .md-content th, .md-content td { border: 1px solid var(--border-default); padding: 6px 10px; font-size: 12px; }
    .md-content th { background: var(--bg-input); color: var(--text-primary); font-weight: 600; }
    .md-content strong { color: var(--text-primary); }
    .msg-row.user .md-content strong { color: #DBEAFE; }
    .md-content blockquote { border-left: 3px solid var(--blue); padding: 2px 12px; margin: 4px 0; color: var(--text-muted); }
    .md-content img { max-width: 100%; border-radius: var(--r-sm); }
    .md-content hr { border: none; border-top: 1px solid var(--border-default); margin: 8px 0; }

    .msg-text { white-space: pre-wrap; }
    .msg-time {
      font-size: 10px; color: var(--text-muted); margin-top: 4px; padding: 0 4px;
    }
    .msg-row.user .msg-time { text-align: right; }

    /* Tool chips */
    .tool-chips { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }
    .tool-chip {
      display: inline-block; padding: 2px 8px; border-radius: 6px;
      font-size: 11px; background: var(--purple-soft); color: var(--purple);
      border: 1px solid rgba(167,139,250,0.15); font-weight: 500;
    }
    .tool-result-toggle {
      font-size: 11px; color: var(--blue); cursor: pointer;
      background: none; border: none; padding: 4px 0;
      font-family: var(--font-sans); font-weight: 500; text-align: left;
    }
    .tool-result-toggle:hover { text-decoration: underline; }
    .tool-result-content {
      font-size: 12px; color: var(--text-muted); white-space: pre-wrap;
      word-break: break-all; max-height: 200px; overflow-y: auto;
      padding: 8px 10px; background: var(--bg-input); border-radius: var(--r-sm);
      margin-top: 4px; border: 1px solid var(--border-subtle);
      font-family: var(--font-mono);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.loadSessions();
  }

  async refresh() {
    this.refreshing = true;
    await this.loadSessions();
    this.refreshing = false;
  }

  async loadSessions() {
    try {
      const res = await api.getSessions();
      this.sessions = res.sessions || [];
    } catch (e: any) {
      this.error = e.message;
    }
  }

  async selectSession(s: any) {
    this.selected = s;
    this.loading = true;
    this.editingNote = false;
    try {
      const res = await api.getSession(s.key);
      this.messages = res.messages || [];
      this.note = res.note || "";
    } catch (e: any) {
      this.error = e.message;
    }
    this.loading = false;
    await this.updateComplete;
    const el = this.shadowRoot?.querySelector(".messages-container");
    if (el) el.scrollTop = el.scrollHeight;
  }

  private startEditNote() {
    this.noteDraft = this.note;
    this.editingNote = true;
  }

  private cancelEditNote() {
    this.editingNote = false;
  }

  private async saveNote() {
    if (!this.selected) return;
    try {
      await api.updateSessionNote(this.selected.key, this.noteDraft);
      this.note = this.noteDraft;
      this.editingNote = false;
      const s = this.sessions.find((s) => s.key === this.selected.key);
      if (s) s.note = this.noteDraft;
      this.requestUpdate();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  async deleteSession() {
    if (!this.selected) return;
    if (!confirm(`Delete session ${this.selected.key}?`)) return;
    try {
      await api.deleteSession(this.selected.key);
      this.selected = null;
      this.messages = [];
      await this.loadSessions();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  // Channel sort order: messaging channels first, then cli, cron, heartbeat, unknown last
  private channelOrder(ch: string): number {
    const order: Record<string, number> = { cli: 90, cron: 91, heartbeat: 92, unknown: 99 };
    return order[ch] ?? 1; // messaging channels (telegram, discord, feishu, qq...) sort first
  }

  get channels() {
    const set = new Set(this.sessions.map((s) => s.channel));
    const sorted = Array.from(set).sort((a, b) => {
      const oa = this.channelOrder(a), ob = this.channelOrder(b);
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    });
    return ["", ...sorted];
  }

  get filtered() {
    if (!this.filter) return this.sessions;
    return this.sessions.filter((s) => s.channel === this.filter);
  }

  /** Group sessions by channel (used when filter is "All") */
  get groupedByChannel(): { channel: string; sessions: any[] }[] {
    const groups = new Map<string, any[]>();
    for (const s of this.sessions) {
      const ch = s.channel || "unknown";
      if (!groups.has(ch)) groups.set(ch, []);
      groups.get(ch)!.push(s);
    }
    return Array.from(groups.entries())
      .sort((a, b) => {
        const oa = this.channelOrder(a[0]), ob = this.channelOrder(b[0]);
        if (oa !== ob) return oa - ob;
        return a[0].localeCompare(b[0]);
      })
      .map(([channel, sessions]) => ({ channel, sessions }));
  }

  private fmtTime(ts: string | null) {
    if (!ts) return "";
    try {
      const d = new Date(ts);
      const pad = (n: number) => String(n).padStart(2, "0");
      return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    } catch { return ts || ""; }
  }

  private formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private stripContext(text: string): { clean: string; hadContext: boolean } {
    const re = /\n?\[Runtime Context\]\n(?:[^\n]*\n?)*/g;
    const clean = text.replace(re, "").trim();
    return { clean, hadContext: re.test(text + text) || text.includes("[Runtime Context]") };
  }

  private toggleToolResult(e: Event) {
    const btn = e.target as HTMLElement;
    const content = btn.nextElementSibling as HTMLElement;
    if (content) {
      const hidden = content.style.display === "none" || !content.style.display;
      content.style.display = hidden ? "block" : "none";
      btn.textContent = hidden ? "▾ Hide result" : "▸ Show result";
    }
  }

  private _renderSessionItem(s: any) {
    return html`
      <div
        class="session-item ${this.selected?.key === s.key ? "active" : ""}"
        @click=${() => this.selectSession(s)}
      >
        <div class="session-key">
          <span class="channel-badge ${s.channel}">${s.channel}</span>
          ${s.metadataKey || s.key}
        </div>
        <div class="session-meta">
          <span>${this.fmtTime(s.updatedAt)}</span>
          <span>${this.formatSize(s.sizeBytes)}</span>
        </div>
        ${s.note ? html`<div class="session-note">${s.note}</div>` : ""}
      </div>
    `;
  }

  private renderMessage(msg: any) {
    const role = msg.role || "system";

    if (role === "user") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      const { clean } = this.stripContext(text);
      return html`
        <div class="msg-row user">
          <div class="msg-bubble"><div class="md-content">${unsafeHTML(renderMarkdown(clean))}</div></div>
          <div class="msg-time">${this.fmtTime(msg.timestamp)}</div>
        </div>
      `;
    }

    if (role === "assistant" && msg.content === null && msg.tool_calls?.length) {
      return html`
        <div class="msg-row assistant">
          <div class="msg-bubble tool-msg">
            <div class="tool-chips">
              ${msg.tool_calls.map((tc: any) => html`
                <span class="tool-chip">${tc.function?.name || tc.type}</span>
              `)}
            </div>
          </div>
          <div class="msg-time">${this.fmtTime(msg.timestamp)}</div>
        </div>
      `;
    }

    if (role === "tool") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      return html`
        <div class="msg-row assistant">
          <div class="msg-bubble tool-msg">
            <button class="tool-result-toggle" @click=${this.toggleToolResult}>▸ Show result</button>
            <div class="tool-result-content" style="display:none">${text}</div>
          </div>
        </div>
      `;
    }

    if (role === "assistant") {
      const text = typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
      return html`
        <div class="msg-row assistant">
          <div class="msg-bubble"><div class="md-content">${unsafeHTML(renderMarkdown(text))}</div></div>
          ${msg.tools_used?.length
            ? html`<div style="padding:0 4px;margin-top:2px">
                <div class="tool-chips">
                  ${msg.tools_used.map((t: string) => html`<span class="tool-chip">${t}</span>`)}
                </div>
              </div>`
            : ""}
          <div class="msg-time">${this.fmtTime(msg.timestamp)}</div>
        </div>
      `;
    }

    return html`
      <div class="msg-row assistant">
        <div class="msg-bubble tool-msg"><span class="msg-text">${JSON.stringify(msg.content)}</span></div>
        <div class="msg-time">${this.fmtTime(msg.timestamp)}</div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <h1>Sessions</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="Refresh">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="layout">
        <div class="list-panel">
          <div class="filters">
            ${this.channels.map(
              (ch) => html`
                <button
                  class="filter-btn ${ch === this.filter ? "active" : ""}"
                  @click=${() => (this.filter = ch)}
                >${ch || "All"}</button>
              `
            )}
          </div>
          <div class="session-list">
            ${!this.filter
              ? this.groupedByChannel.map(g => html`
                  <div class="group-header">${g.channel} (${g.sessions.length})</div>
                  ${g.sessions.map(s => this._renderSessionItem(s))}
                `)
              : this.filtered.map(s => this._renderSessionItem(s))
            }
          </div>
        </div>
        <div class="detail-panel">
          ${!this.selected
            ? html`<div class="empty">Select a session to view</div>`
            : this.loading
            ? html`<div class="empty">Loading...</div>`
            : html`
                <div class="detail-header">
                  <h2>${this.selected.metadataKey || this.selected.key}</h2>
                  <button class="delete-btn" @click=${this.deleteSession}>Delete</button>
                </div>
                <div class="note-bar">
                  <span class="note-label">Note</span>
                  ${this.editingNote
                    ? html`
                        <input class="note-input"
                          .value=${this.noteDraft}
                          @input=${(e: any) => (this.noteDraft = e.target.value)}
                          @keydown=${(e: KeyboardEvent) => {
                            if (e.key === "Enter") this.saveNote();
                            if (e.key === "Escape") this.cancelEditNote();
                          }}
                          placeholder="Add a note..." />
                        <button class="note-btn note-btn-save" @click=${this.saveNote}>Save</button>
                        <button class="note-btn" @click=${this.cancelEditNote}>Cancel</button>
                      `
                    : html`
                        <span class="note-text ${this.note ? "" : "note-placeholder"}" @click=${this.startEditNote}>
                          ${this.note || "Click to add note..."}
                        </span>
                        <button class="note-btn" @click=${this.startEditNote}>${this.note ? "Edit" : "Add"}</button>
                      `}
                </div>
                <div class="messages-container">
                  ${this.messages.map((m) => this.renderMessage(m))}
                </div>
              `}
        </div>
      </div>
    `;
  }
}
