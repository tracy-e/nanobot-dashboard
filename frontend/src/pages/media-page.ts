import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api } from "../api/client.js";

@customElement("media-page")
export class MediaPage extends LitElement {
  @state() private files: any[] = [];
  @state() private selected: any = null;
  @state() private error = "";
  @state() private refreshing = false;

  static styles = css`
    :host { display: block; }

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
      width: 280px; flex-shrink: 0; overflow-y: auto;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); box-shadow: var(--shadow-card);
      display: flex; flex-direction: column;
    }
    .stat {
      color: var(--text-muted); font-size: 12px; font-weight: 600;
      padding: 10px 16px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .file-item {
      padding: 12px 16px; border-bottom: 1px solid var(--border-subtle);
      cursor: pointer; transition: all 0.12s var(--ease);
      display: flex; align-items: center; gap: 12px;
    }
    .file-item:hover { background: var(--bg-elevated); }
    .file-item.active {
      background: var(--bg-elevated);
      border-left: 3px solid var(--green);
    }
    .file-icon {
      width: 36px; height: 36px; border-radius: var(--r-sm);
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
    }
    .file-icon.image { background: var(--purple-soft); color: var(--purple); }
    .file-icon.audio { background: var(--blue-soft); color: var(--blue); }
    .file-icon.video { background: var(--orange-soft); color: var(--orange); }
    .file-icon.text { background: var(--green-soft); color: var(--green); }
    .file-icon.other { background: var(--bg-elevated); color: var(--text-muted); }
    .file-info { min-width: 0; flex: 1; }
    .file-name {
      font-size: 13px; color: var(--text-primary); font-weight: 500;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .file-meta {
      font-size: 11px; color: var(--text-muted); margin-top: 2px;
      display: flex; gap: 10px;
    }

    /* ---- Preview Panel ---- */
    .preview-panel {
      flex: 1; display: flex; flex-direction: column;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .preview-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .preview-header h2 {
      font-size: 13px; color: var(--text-primary); font-weight: 600; margin: 0;
      font-family: var(--font-mono);
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .preview-body {
      flex: 1; overflow: auto; display: flex;
      align-items: center; justify-content: center;
      padding: 20px; min-height: 0;
    }
    .preview-body img {
      max-width: 100%; max-height: 100%; object-fit: contain;
      border-radius: var(--r-sm);
    }
    .preview-body audio { width: 100%; max-width: 480px; }
    .preview-body video {
      max-width: 100%; max-height: 100%; border-radius: var(--r-sm);
    }
    .preview-body pre {
      width: 100%; align-self: flex-start;
      white-space: pre-wrap; word-break: break-word;
      font-family: var(--font-mono); font-size: 13px; line-height: 1.6;
      color: var(--text-secondary); margin: 0;
    }

    .delete-btn {
      padding: 6px 14px; background: transparent; color: var(--red);
      border: 1px solid var(--red-soft); border-radius: var(--r-sm);
      cursor: pointer; font-size: 12px; font-weight: 500;
      font-family: var(--font-sans); transition: all 0.15s var(--ease);
      flex-shrink: 0;
    }
    .delete-btn:hover { background: var(--red-soft); }

    .empty { color: var(--text-muted); text-align: center; padding: 48px; font-size: 13px; }
    .error { color: var(--red); margin-bottom: 12px; font-size: 13px; }

    .back-btn {
      display: none; padding: 6px 14px; background: transparent;
      color: var(--text-secondary); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); cursor: pointer; font-size: 12px;
      font-weight: 500; font-family: var(--font-sans);
      transition: all 0.15s var(--ease); margin-right: 8px;
    }
    .back-btn:hover { color: var(--text-primary); background: var(--bg-hover); }

    @media (max-width: 768px) {
      h1 { font-size: 20px; }
      .layout { flex-direction: column; height: auto; min-height: calc(100vh - 110px); }
      .list-panel { width: 100%; max-height: 100%; flex-shrink: 0; }
      .preview-panel { flex: 1; min-height: 60vh; }
      .list-panel.hidden { display: none; }
      .preview-panel.hidden { display: none; }
      .back-btn { display: inline-block; }
    }
  `;

  @state() private mobileShowDetail = false;
  @state() private fileText = "";

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
      const res = await api.getMediaFiles();
      this.files = res.files || [];
    } catch (e: any) {
      this.error = e.message;
    }
  }

  async selectFile(f: any) {
    this.selected = f;
    this.mobileShowDetail = true;
    this.fileText = "";
    if (f.type === "text") {
      try {
        const res = await fetch(api.mediaUrl(f.name));
        this.fileText = await res.text();
      } catch (e: any) {
        this.error = e.message;
      }
    }
  }

  private goBackToList() {
    this.mobileShowDetail = false;
  }

  async deleteFile() {
    if (!this.selected) return;
    if (!confirm(`Delete "${this.selected.name}"?`)) return;
    try {
      await api.deleteMediaFile(this.selected.name);
      this.selected = null;
      this.mobileShowDetail = false;
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private typeIcon(type: string): string {
    const icons: Record<string, string> = {
      image: "🖼", audio: "🎵", video: "🎬", text: "📄",
    };
    return icons[type] || "📦";
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  private formatTime(ts: number): string {
    return new Date(ts * 1000).toLocaleString("zh-CN");
  }

  private renderPreview() {
    if (!this.selected) return html`<div class="empty">Select a file to preview</div>`;
    const url = api.mediaUrl(this.selected.name);
    switch (this.selected.type) {
      case "image":
        return html`<img src=${url} alt=${this.selected.name} />`;
      case "audio":
        return html`<audio controls src=${url}></audio>`;
      case "video":
        return html`<video controls src=${url}></video>`;
      case "text":
        return html`<pre>${this.fileText}</pre>`;
      default:
        return html`<div class="empty">
          <div style="font-size:32px;margin-bottom:12px">📦</div>
          <div>${this.selected.mime}</div>
          <div style="margin-top:8px"><a href=${url} download style="color:var(--blue)">Download</a></div>
        </div>`;
    }
  }

  render() {
    return html`
      <div class="page-header">
        <h1>Media</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="Refresh">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="layout">
        <div class="list-panel ${this.mobileShowDetail ? "hidden" : ""}">
          <div class="stat">${this.files.length} files</div>
          ${this.files.map(
            (f) => html`
              <div
                class="file-item ${this.selected?.name === f.name ? "active" : ""}"
                @click=${() => this.selectFile(f)}
              >
                <div class="file-icon ${f.type}">${this.typeIcon(f.type)}</div>
                <div class="file-info">
                  <div class="file-name">${f.name}</div>
                  <div class="file-meta">
                    <span>${this.formatSize(f.size)}</span>
                    <span>${f.mime}</span>
                  </div>
                </div>
              </div>
            `
          )}
        </div>
        <div class="preview-panel ${!this.mobileShowDetail ? "hidden" : ""}">
          ${!this.selected
            ? html`<div class="empty">Select a file to preview</div>`
            : html`
                <div class="preview-header">
                  <div style="display:flex;align-items:center;min-width:0">
                    <button class="back-btn" @click=${this.goBackToList}>← Back</button>
                    <h2>${this.selected.name}</h2>
                  </div>
                  <button class="delete-btn" @click=${this.deleteFile}>Delete</button>
                </div>
                <div class="preview-body">
                  ${this.renderPreview()}
                </div>
              `}
        </div>
      </div>
    `;
  }
}
