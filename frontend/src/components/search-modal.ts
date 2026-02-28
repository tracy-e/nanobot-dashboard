import { LitElement, html, css } from "lit";
import { customElement, state, query } from "lit/decorators.js";
import { api } from "../api/client.js";

interface SearchMatch {
  line: number;
  text: string;
}

interface SearchResult {
  path: string;
  name: string;
  group: string;
  matches: SearchMatch[];
}

@customElement("search-modal")
export class SearchModal extends LitElement {
  @state() private open = false;
  @state() private queryText = "";
  @state() private results: SearchResult[] = [];
  @state() private loading = false;
  @state() private selectedIndex = 0;

  @query("input") private inputEl!: HTMLInputElement;

  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private abortController: AbortController | null = null;

  static styles = css`
    .overlay {
      position: fixed; inset: 0; z-index: 2000;
      background: rgba(0, 0, 0, 0.6); backdrop-filter: blur(4px);
      display: flex; align-items: flex-start; justify-content: center;
      padding-top: 12vh;
    }
    .modal {
      width: 560px; max-width: 92vw;
      max-height: 70vh;
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: var(--r-lg);
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
      display: flex; flex-direction: column;
      overflow: hidden;
    }
    .search-input-wrapper {
      padding: 16px 18px; border-bottom: 1px solid var(--border-subtle);
      display: flex; align-items: center; gap: 10px;
    }
    .search-icon {
      color: var(--text-muted); font-size: 16px; flex-shrink: 0;
    }
    input {
      flex: 1; background: none; border: none; outline: none;
      color: var(--text-primary); font-size: 15px;
      font-family: var(--font-sans);
    }
    input::placeholder { color: var(--text-muted); }
    .kbd {
      font-size: 11px; color: var(--text-muted);
      background: var(--bg-elevated); border: 1px solid var(--border-default);
      border-radius: 4px; padding: 2px 6px;
      font-family: var(--font-mono);
    }
    .results {
      flex: 1; overflow-y: auto; padding: 6px 0;
    }
    .empty-state {
      padding: 32px 20px; text-align: center;
      color: var(--text-muted); font-size: 13px;
    }
    .result-item {
      padding: 10px 18px; cursor: pointer;
      transition: background 0.1s;
    }
    .result-item:hover, .result-item.selected {
      background: var(--bg-elevated);
    }
    .result-item.selected {
      border-left: 3px solid var(--green);
      padding-left: 15px;
    }
    .result-header {
      display: flex; align-items: center; gap: 8px;
    }
    .result-name {
      font-size: 13.5px; font-weight: 600; color: var(--text-primary);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .result-path {
      font-size: 11px; color: var(--text-muted);
      font-family: var(--font-mono);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .result-group {
      font-size: 10px; color: var(--green); font-weight: 600;
      text-transform: uppercase; letter-spacing: 0.5px;
      background: var(--green-glow); padding: 1px 6px;
      border-radius: 3px; flex-shrink: 0;
    }
    .match-lines {
      margin-top: 5px;
    }
    .match-line {
      font-size: 12px; color: var(--text-secondary);
      font-family: var(--font-mono); line-height: 1.5;
      display: flex; gap: 8px; align-items: baseline;
    }
    .match-line-num {
      color: var(--text-muted); font-size: 10px; flex-shrink: 0;
      min-width: 28px; text-align: right;
    }
    .match-line-text {
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .loading-indicator {
      padding: 20px; text-align: center;
      color: var(--text-muted); font-size: 12px;
    }
    .footer-hint {
      padding: 8px 18px; border-top: 1px solid var(--border-subtle);
      display: flex; gap: 14px; align-items: center;
      font-size: 11px; color: var(--text-muted);
    }
    .footer-hint .kbd { margin: 0 2px; }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener("keydown", this.handleGlobalKey);
    window.addEventListener("open-search", this.openModal);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("keydown", this.handleGlobalKey);
    window.removeEventListener("open-search", this.openModal);
  }

  private handleGlobalKey = (e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      this.show();
    }
  };

  private openModal = () => {
    this.show();
  };

  show() {
    this.open = true;
    this.queryText = "";
    this.results = [];
    this.selectedIndex = 0;
    this.updateComplete.then(() => this.inputEl?.focus());
  }

  private close() {
    this.open = false;
    this.queryText = "";
    this.results = [];
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.abortController) this.abortController.abort();
  }

  private onInput(e: InputEvent) {
    this.queryText = (e.target as HTMLInputElement).value;
    this.selectedIndex = 0;
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    if (this.queryText.trim().length < 2) {
      this.results = [];
      this.loading = false;
      return;
    }
    this.loading = true;
    this.debounceTimer = setTimeout(() => this.doSearch(), 300);
  }

  private async doSearch() {
    if (this.abortController) this.abortController.abort();
    this.abortController = new AbortController();
    try {
      const res = await api.search(this.queryText.trim());
      this.results = res.results;
    } catch {
      // aborted or network error — ignore
    }
    this.loading = false;
  }

  private onKeydown(e: KeyboardEvent) {
    const total = this.results.length;
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      this.selectedIndex = total ? (this.selectedIndex + 1) % total : 0;
      this.scrollSelected();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.selectedIndex = total ? (this.selectedIndex - 1 + total) % total : 0;
      this.scrollSelected();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this.results[this.selectedIndex]) {
        this.navigateTo(this.results[this.selectedIndex]);
      }
    }
  }

  private scrollSelected() {
    this.updateComplete.then(() => {
      const el = this.shadowRoot?.querySelector(".result-item.selected");
      el?.scrollIntoView({ block: "nearest" });
    });
  }

  private navigateTo(result: SearchResult) {
    this.close();
    // Navigate to the correct page based on group
    const page = result.group === "knowledge" ? "knowledge" : "workspace";
    location.hash = page;
    // Wait for page to render, then dispatch file navigate event
    setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("dashboard-file-navigate", {
          detail: { path: result.path },
        })
      );
    }, 100);
  }

  private onOverlayClick(e: MouseEvent) {
    if ((e.target as HTMLElement).classList.contains("overlay")) {
      this.close();
    }
  }

  private groupLabel(group: string): string {
    const labels: Record<string, string> = {
      workspace: "工作区",
      memory: "记忆",
      knowledge: "知识库",
    };
    return labels[group] || group;
  }

  render() {
    if (!this.open) return html``;
    return html`
      <div class="overlay" @click=${this.onOverlayClick}>
        <div class="modal" @keydown=${this.onKeydown}>
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              placeholder="搜索文件名或内容..."
              .value=${this.queryText}
              @input=${this.onInput}
              autofocus
            />
            <span class="kbd">Esc</span>
          </div>
          <div class="results">
            ${this.loading
              ? html`<div class="loading-indicator">搜索中...</div>`
              : this.queryText.trim().length >= 2 && !this.results.length
              ? html`<div class="empty-state">没有找到匹配结果</div>`
              : this.queryText.trim().length < 2 && !this.results.length
              ? html`<div class="empty-state">输入关键词搜索文件</div>`
              : this.results.map(
                  (r, i) => html`
                    <div
                      class="result-item ${i === this.selectedIndex ? "selected" : ""}"
                      @click=${() => this.navigateTo(r)}
                      @mouseenter=${() => (this.selectedIndex = i)}
                    >
                      <div class="result-header">
                        <span class="result-name">${r.name}</span>
                        <span class="result-group">${this.groupLabel(r.group)}</span>
                      </div>
                      <div class="result-path">${r.path}</div>
                      ${r.matches.length
                        ? html`
                            <div class="match-lines">
                              ${r.matches.map(
                                (m) => html`
                                  <div class="match-line">
                                    <span class="match-line-num">L${m.line}</span>
                                    <span class="match-line-text">${m.text}</span>
                                  </div>
                                `
                              )}
                            </div>
                          `
                        : ""}
                    </div>
                  `
                )}
          </div>
          <div class="footer-hint">
            <span><span class="kbd">↑↓</span> 导航</span>
            <span><span class="kbd">Enter</span> 跳转</span>
            <span><span class="kbd">Esc</span> 关闭</span>
          </div>
        </div>
      </div>
    `;
  }
}
