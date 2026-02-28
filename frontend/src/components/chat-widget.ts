import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { renderMarkdown } from "../utils/markdown.js";
import hljsStyles from "highlight.js/styles/github-dark.css?inline";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

@customElement("chat-widget")
export class ChatWidget extends LitElement {
  @state() private open = false;
  @state() private messages: ChatMessage[] = [];
  @state() private input = "";
  @state() private sending = false;
  @state() private sessionId = "";
  @state() private progressText = "";
  @state() private historyLoaded = false;
  @state() private contextFile = "";

  static styles = css`
    ${unsafeCSS(hljsStyles)}

    /* ---- Floating button ---- */
    .fab {
      position: fixed; bottom: 24px; right: 24px; z-index: 900;
      width: 52px; height: 52px; border-radius: 50%;
      background: var(--green, #4ADE80); border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 16px rgba(74, 222, 128, 0.35);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      color: #0a0f0d;
    }
    .fab:hover { transform: scale(1.08); box-shadow: 0 6px 24px rgba(74, 222, 128, 0.45); }
    .fab svg { width: 24px; height: 24px; }
    .fab-emoji { font-size: 26px; line-height: 1; }

    /* ---- Chat window ---- */
    .chat-window {
      position: fixed; bottom: 88px; right: 24px; z-index: 901;
      width: 400px; height: 560px;
      background: var(--bg-card, #161b22); border: 1px solid var(--border-default, #30363d);
      border-radius: 16px; display: flex; flex-direction: column;
      box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
      overflow: hidden;
      animation: slideUp 0.2s ease;
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(12px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* ---- Header ---- */
    .chat-header {
      display: flex; align-items: center; gap: 10px;
      padding: 14px 16px; border-bottom: 1px solid var(--border-subtle, #21262d);
      background: var(--bg-surface, #0d1117); flex-shrink: 0;
    }
    .status-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--green, #4ADE80); flex-shrink: 0;
    }
    .chat-title {
      font-size: 14px; font-weight: 600; color: var(--text-primary, #e6edf3);
      flex: 1; font-family: var(--font-sans);
    }
    .header-btn {
      width: 30px; height: 30px; border-radius: 6px;
      background: transparent; border: 1px solid transparent;
      color: var(--text-muted, #7d8590); cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; transition: all 0.15s ease;
    }
    .header-btn:hover {
      color: var(--text-secondary, #b1bac4);
      background: var(--bg-hover, rgba(177,186,196,0.08));
      border-color: var(--border-default, #30363d);
    }

    /* ---- Messages area ---- */
    .chat-messages {
      flex: 1; overflow-y: auto; padding: 16px;
      display: flex; flex-direction: column; gap: 8px;
    }
    .chat-messages::-webkit-scrollbar { width: 4px; }
    .chat-messages::-webkit-scrollbar-thumb { background: var(--border-default, #30363d); border-radius: 2px; }

    .msg-row { display: flex; flex-direction: column; }
    .msg-row.user { align-items: flex-end; }
    .msg-row.assistant { align-items: flex-start; }
    .msg-bubble {
      padding: 10px 14px; border-radius: 12px;
      font-size: 13px; line-height: 1.6; max-width: 85%; word-break: break-word;
      font-family: var(--font-sans);
    }
    .msg-row.user .msg-bubble {
      background: linear-gradient(135deg, #1A365D, #1E3A5F);
      color: #DBEAFE; border-bottom-right-radius: 4px;
      border: 1px solid rgba(96, 165, 250, 0.12);
    }
    .msg-row.assistant .msg-bubble {
      background: var(--bg-elevated, #1c2128); color: var(--text-secondary, #b1bac4);
      border-bottom-left-radius: 4px;
      border: 1px solid var(--border-subtle, #21262d);
    }

    /* ---- Markdown in bubbles ---- */
    .md-content h1 { font-size: 16px; color: var(--text-primary); margin: 8px 0 4px; }
    .md-content h2 { font-size: 14px; color: var(--text-primary); margin: 6px 0 3px; }
    .md-content h3 { font-size: 13px; color: var(--text-primary); margin: 4px 0 2px; }
    .md-content p { margin: 3px 0; }
    .md-content p:first-child { margin-top: 0; }
    .md-content p:last-child { margin-bottom: 0; }
    .md-content a { color: var(--blue, #58a6ff); text-decoration: none; }
    .md-content a:hover { text-decoration: underline; }
    .md-content ul, .md-content ol { padding-left: 18px; margin: 3px 0; }
    .md-content li { margin: 1px 0; }
    .md-content pre {
      background: var(--bg-input, #0d1117); border: 1px solid var(--border-subtle, #21262d);
      border-radius: 6px; padding: 8px; overflow-x: auto;
      margin: 4px 0; font-size: 11px; line-height: 1.5;
    }
    .md-content code { font-family: var(--font-mono); }
    .md-content :not(pre) > code {
      background: var(--bg-hover, rgba(177,186,196,0.08)); padding: 1px 4px;
      border-radius: 4px; font-size: 11px; color: var(--text-primary);
    }
    .msg-row.user .md-content :not(pre) > code {
      background: rgba(255,255,255,0.12); color: #DBEAFE;
    }
    .msg-row.user .md-content pre {
      background: rgba(0,0,0,0.25); border-color: rgba(255,255,255,0.08);
    }
    .msg-row.user .md-content a { color: #93C5FD; }
    .md-content strong { color: var(--text-primary); }
    .msg-row.user .md-content strong { color: #DBEAFE; }
    .md-content blockquote { border-left: 3px solid var(--blue, #58a6ff); padding: 2px 10px; margin: 3px 0; color: var(--text-muted); }
    .md-content table { border-collapse: collapse; margin: 4px 0; width: 100%; }
    .md-content th, .md-content td { border: 1px solid var(--border-default); padding: 4px 8px; font-size: 11px; }
    .md-content th { background: var(--bg-input); color: var(--text-primary); font-weight: 600; }
    .md-content img { max-width: 100%; border-radius: 6px; }

    /* ---- Progress indicator ---- */
    .progress-row {
      display: flex; align-items: center; gap: 8px; padding: 4px 0;
    }
    .typing-dots {
      display: flex; gap: 3px; align-items: center;
    }
    .typing-dots span {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--text-muted, #7d8590);
      animation: bounce 1.2s infinite;
    }
    .typing-dots span:nth-child(2) { animation-delay: 0.2s; }
    .typing-dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
      30% { transform: translateY(-4px); opacity: 1; }
    }
    .progress-text {
      font-size: 11px; color: var(--text-muted, #7d8590);
      font-style: italic; font-family: var(--font-sans);
    }

    /* ---- Context bar ---- */
    .context-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 16px; flex-shrink: 0;
      background: rgba(74, 222, 128, 0.06);
      border-top: 1px solid rgba(74, 222, 128, 0.15);
      font-size: 12px; color: var(--green, #4ADE80);
      font-family: var(--font-mono);
    }
    .context-bar .ctx-icon { flex-shrink: 0; }
    .context-bar .ctx-path {
      flex: 1; overflow: hidden; text-overflow: ellipsis;
      white-space: nowrap; direction: rtl; text-align: left;
    }
    .context-bar .ctx-clear {
      flex-shrink: 0; width: 20px; height: 20px;
      border-radius: 4px; border: none; cursor: pointer;
      background: transparent; color: var(--text-muted, #7d8590);
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; transition: color 0.15s ease;
    }
    .context-bar .ctx-clear:hover { color: var(--text-primary, #e6edf3); }

    /* ---- Input area ---- */
    .chat-input-area {
      display: flex; gap: 8px; padding: 12px 16px;
      border-top: 1px solid var(--border-subtle, #21262d);
      background: var(--bg-surface, #0d1117); flex-shrink: 0;
    }
    .chat-input {
      flex: 1; background: var(--bg-input, #0d1117);
      border: 1px solid var(--border-default, #30363d);
      border-radius: 8px; padding: 8px 12px;
      color: var(--text-primary, #e6edf3); font-size: 13px;
      font-family: var(--font-sans); outline: none;
      transition: border-color 0.15s ease;
    }
    .chat-input:focus { border-color: var(--green, #4ADE80); }
    .chat-input:disabled { opacity: 0.5; cursor: not-allowed; }
    .chat-input::placeholder { color: var(--text-muted, #7d8590); }
    .send-btn {
      width: 36px; height: 36px; border-radius: 8px;
      background: var(--green, #4ADE80); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: #0a0f0d; transition: opacity 0.15s ease;
      flex-shrink: 0;
    }
    .send-btn:hover { opacity: 0.85; }
    .send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .send-btn svg { width: 18px; height: 18px; }

    .empty-state {
      flex: 1; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 8px;
      color: var(--text-muted, #7d8590); font-size: 13px;
      font-family: var(--font-sans);
    }
    .empty-state .icon { font-size: 32px; opacity: 0.5; }

    /* ---- Mobile ---- */
    @media (max-width: 768px) {
      .chat-window {
        width: calc(100vw - 32px); right: 16px;
        height: 70vh; bottom: 84px;
      }
    }
  `;

  private _onFileSelect = (e: Event) => {
    const path = (e as CustomEvent).detail?.path;
    this.contextFile = path || "";
  };

  private _onHashChange = () => {
    const hash = location.hash.replace("#", "");
    const noFilePages = ["status", "sessions", "cron", "media", ""];
    if (noFilePages.includes(hash)) {
      this.contextFile = "";
    }
  };

  connectedCallback() {
    super.connectedCallback();
    this.sessionId = localStorage.getItem("chat_session_id") || "";
    window.addEventListener("dashboard-file-select", this._onFileSelect);
    window.addEventListener("hashchange", this._onHashChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("dashboard-file-select", this._onFileSelect);
    window.removeEventListener("hashchange", this._onHashChange);
  }

  private async loadHistory() {
    if (!this.sessionId || this.historyLoaded) return;
    try {
      const token = localStorage.getItem("dashboard_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`/api/chat/${this.sessionId}/history`, { headers });
      if (res.ok) {
        const data = await res.json();
        this.messages = data.messages || [];
      }
    } catch {
      // ignore
    }
    this.historyLoaded = true;
    await this.updateComplete;
    this.scrollToBottom();
  }

  private toggleOpen() {
    this.open = !this.open;
    if (this.open) {
      this.loadHistory();
      // Focus input after opening
      this.updateComplete.then(() => {
        this.shadowRoot?.querySelector<HTMLInputElement>(".chat-input")?.focus();
      });
    }
  }

  private async newChat() {
    try {
      const token = localStorage.getItem("dashboard_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch("/api/chat/new", { method: "POST", headers });
      if (res.ok) {
        const data = await res.json();
        this.sessionId = data.session_id;
        localStorage.setItem("chat_session_id", this.sessionId);
        this.messages = [];
        this.historyLoaded = true;
        this.progressText = "";
      }
    } catch {
      // ignore
    }
  }

  private async sendMessage() {
    const msg = this.input.trim();
    if (!msg || this.sending) return;

    this.input = "";
    this.sending = true;
    this.progressText = "";
    this.messages = [...this.messages, { role: "user", content: msg }];
    await this.updateComplete;
    this.scrollToBottom();

    const token = localStorage.getItem("dashboard_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: msg,
          session_id: this.sessionId || undefined,
          ...(this.contextFile ? {
            context: {
              page: location.hash.replace("#", "") || "status",
              file: this.contextFile,
            },
          } : {}),
        }),
      });

      if (!res.ok || !res.body) {
        this.messages = [...this.messages, {
          role: "assistant",
          content: `错误: ${res.status} ${res.statusText}`,
        }];
        this.sending = false;
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        let eventType = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            try {
              const data = JSON.parse(dataStr);
              if (eventType === "progress") {
                this.progressText = data.text || "";
                await this.updateComplete;
                this.scrollToBottom();
              } else if (eventType === "done") {
                // Save session ID if first message
                if (data.session_id && data.session_id !== this.sessionId) {
                  this.sessionId = data.session_id;
                  localStorage.setItem("chat_session_id", this.sessionId);
                }
                this.messages = [...this.messages, {
                  role: "assistant",
                  content: data.response || "",
                }];
                this.progressText = "";
              } else if (eventType === "error") {
                this.messages = [...this.messages, {
                  role: "assistant",
                  content: `错误: ${data.message}`,
                }];
                this.progressText = "";
              }
            } catch {
              // skip malformed JSON
            }
            eventType = "";
          }
        }
      }
    } catch (e: any) {
      this.messages = [...this.messages, {
        role: "assistant",
        content: `网络错误: ${e.message}`,
      }];
    }

    this.sending = false;
    this.progressText = "";
    await this.updateComplete;
    this.scrollToBottom();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  private scrollToBottom() {
    const container = this.shadowRoot?.querySelector(".chat-messages");
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  }

  render() {
    return html`
      ${this.open ? html`
        <div class="chat-window">
          <div class="chat-header">
            <div class="status-dot"></div>
            <span class="chat-title">nanobot</span>
            <button class="header-btn" @click=${this.newChat} title="新对话">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
            <button class="header-btn" @click=${this.toggleOpen} title="关闭">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
          <div class="chat-messages">
            ${this.messages.length === 0 && !this.sending ? html`
              <div class="empty-state">
                <div class="icon">🤖</div>
                <div>向 nanobot 发送消息</div>
              </div>
            ` : ""}
            ${this.messages.map(m => html`
              <div class="msg-row ${m.role}">
                <div class="msg-bubble">
                  <div class="md-content">${unsafeHTML(renderMarkdown(m.content))}</div>
                </div>
              </div>
            `)}
            ${this.sending ? html`
              <div class="progress-row">
                <div class="typing-dots">
                  <span></span><span></span><span></span>
                </div>
                ${this.progressText ? html`<span class="progress-text">${this.progressText}</span>` : ""}
              </div>
            ` : ""}
          </div>
          ${this.contextFile ? html`
            <div class="context-bar">
              <span class="ctx-icon">📄</span>
              <span class="ctx-path">${this.contextFile}</span>
              <button class="ctx-clear" @click=${() => this.contextFile = ""} title="清除上下文">✕</button>
            </div>
          ` : ""}
          <div class="chat-input-area">
            <input
              class="chat-input"
              placeholder="输入消息..."
              .value=${this.input}
              @input=${(e: any) => this.input = e.target.value}
              @keydown=${this.handleKeyDown}
              ?disabled=${this.sending}
            />
            <button class="send-btn" @click=${this.sendMessage} ?disabled=${this.sending || !this.input.trim()} title="发送">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>
      ` : ""}
      <button class="fab" @click=${this.toggleOpen} title="聊天">
        ${this.open ? html`
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          </svg>
        ` : html`<span class="fab-emoji">🤖</span>`}
      </button>
    `;
  }
}
