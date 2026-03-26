import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api } from "../api/client.js";
import { t } from "../i18n.js";
import { renderMarkdown } from "../utils/markdown.js";

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
      width: 280px; flex-shrink: 0; overflow: hidden;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); box-shadow: var(--shadow-card);
      display: flex; flex-direction: column;
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
      overflow: hidden;
    }
    .file-icon.image { background: var(--purple-soft); color: var(--purple); }
    .file-icon.audio { background: var(--blue-soft); color: var(--blue); }
    .file-icon.video { background: var(--orange-soft); color: var(--orange); }
    .file-icon.text { background: var(--green-soft); color: var(--green); }
    .file-icon.pdf { background: var(--red-soft); color: var(--red); }
    .file-icon.other { background: var(--bg-elevated); color: var(--text-muted); }
    .file-icon img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .dir-header {
      padding: 8px 16px; cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      font-size: 12px; font-weight: 600; color: var(--text-secondary);
      background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
      user-select: none; transition: background 0.12s var(--ease);
    }
    .dir-header:hover { background: var(--bg-elevated); }
    .dir-arrow { font-size: 10px; transition: transform 0.15s var(--ease); }
    .dir-arrow.collapsed { transform: rotate(-90deg); }
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
    .preview-body iframe.pdf-preview {
      width: 100%; height: 100%; border: none; border-radius: var(--r-sm);
    }
    .preview-body pre {
      width: 100%; align-self: flex-start;
      white-space: pre-wrap; word-break: break-word;
      font-family: var(--font-mono); font-size: 13px; line-height: 1.6;
      color: var(--text-secondary); margin: 0;
    }
    .preview-body .md-preview {
      width: 100%; align-self: flex-start;
      font-size: 14px; line-height: 1.7; color: var(--text-secondary);
    }
    .md-preview h1 { font-size: 20px; color: var(--text-primary); margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border-default); font-weight: 700; }
    .md-preview h2 { font-size: 17px; color: var(--text-primary); margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-subtle); font-weight: 600; }
    .md-preview h3 { font-size: 15px; color: var(--text-primary); margin: 14px 0 6px; font-weight: 600; }
    .md-preview h4, .md-preview h5, .md-preview h6 { font-size: 14px; color: var(--text-secondary); margin: 12px 0 4px; font-weight: 600; }
    .md-preview p { margin: 8px 0; }
    .md-preview a { color: var(--blue); text-decoration: none; }
    .md-preview a:hover { text-decoration: underline; }
    .md-preview ul, .md-preview ol { padding-left: 24px; margin: 6px 0; }
    .md-preview li { margin: 3px 0; }
    .md-preview blockquote {
      border-left: 3px solid var(--green); padding: 6px 16px;
      margin: 8px 0; color: var(--text-muted); background: var(--green-glow);
      border-radius: 0 var(--r-sm) var(--r-sm) 0;
    }
    .md-preview pre {
      background: var(--bg-input); border: 1px solid var(--border-subtle);
      border-radius: var(--r-sm); padding: 14px 16px;
      margin: 10px 0; font-size: 13px; line-height: 1.5;
      white-space: pre-wrap; word-break: break-all;
    }
    .md-preview code { font-family: var(--font-mono); }
    .md-preview :not(pre) > code {
      background: var(--bg-elevated); padding: 2px 6px; border-radius: 4px;
      font-size: 12px; color: var(--text-primary);
    }
    .md-preview table { border-collapse: collapse; margin: 10px 0; width: 100%; }
    .md-preview th, .md-preview td {
      border: 1px solid var(--border-default); padding: 8px 12px;
      text-align: left; font-size: 13px;
    }
    .md-preview th { background: var(--bg-surface); color: var(--text-primary); font-weight: 600; }
    .md-preview tr:nth-child(even) { background: var(--bg-elevated); }
    .md-preview hr { border: none; border-top: 1px solid var(--border-default); margin: 16px 0; }
    .md-preview strong { color: var(--text-primary); }
    .md-preview img { max-width: 100%; border-radius: var(--r-sm); }

    .delete-btn {
      padding: 6px 14px; background: transparent; color: var(--red);
      border: 1px solid var(--red-soft); border-radius: var(--r-sm);
      cursor: pointer; font-size: 12px; font-weight: 500;
      font-family: var(--font-sans); transition: all 0.15s var(--ease);
      flex-shrink: 0;
    }
    .delete-btn:hover { background: var(--red-soft); }

    /* ---- Select Mode ---- */
    .file-list { flex: 1; overflow-y: auto; min-height: 0; }
    .select-bar {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 12px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .select-bar .sel-btn {
      padding: 4px 10px; font-size: 11px; font-weight: 500;
      border: 1px solid var(--border-default); border-radius: var(--r-sm);
      background: transparent; color: var(--text-muted);
      cursor: pointer; font-family: var(--font-sans);
      transition: all 0.15s var(--ease);
    }
    .select-bar .sel-btn:hover { color: var(--text-secondary); border-color: var(--text-muted); }
    .select-bar .sel-btn.active {
      color: var(--green); border-color: var(--green); background: var(--green-glow);
    }
    .select-bar .sel-btn.danger {
      color: var(--red); border-color: var(--red-soft);
    }
    .select-bar .sel-btn.danger:hover { background: var(--red-soft); }
    .select-bar .spacer { flex: 1; }
    .checkbox {
      width: 18px; height: 18px; border-radius: 4px; flex-shrink: 0;
      border: 1.5px solid var(--border-default); background: transparent;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.12s var(--ease);
      font-size: 11px; color: transparent;
    }
    .checkbox.checked {
      background: var(--green); border-color: var(--green); color: #fff;
    }

    .empty { color: var(--text-muted); text-align: center; padding: 48px; font-size: 13px; }
    .error { color: var(--red); margin-bottom: 12px; font-size: 13px; }

    /* ---- Delete Confirm Dialog ---- */
    .dialog-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: var(--overlay-bg); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
    }
    .dialog {
      background: var(--bg-card); border: 1px solid var(--border-default);
      border-radius: var(--r-lg); padding: 24px 28px;
      min-width: 320px; max-width: 400px;
      box-shadow: 0 16px 48px rgba(0,0,0,0.4);
    }
    .dialog h3 {
      margin: 0 0 8px; font-size: 15px; font-weight: 600;
      color: var(--text-primary);
    }
    .dialog p {
      margin: 0 0 20px; font-size: 13px; color: var(--text-secondary);
      line-height: 1.5; word-break: break-all;
    }
    .dialog-actions {
      display: flex; justify-content: flex-end; gap: 10px;
    }
    .dialog-actions button {
      padding: 7px 18px; border-radius: var(--r-sm);
      font-size: 13px; font-weight: 500; cursor: pointer;
      font-family: var(--font-sans); transition: all 0.15s var(--ease);
    }
    .btn-cancel {
      background: var(--bg-elevated); color: var(--text-secondary);
      border: 1px solid var(--border-default);
    }
    .btn-cancel:hover { color: var(--text-primary); background: var(--bg-hover); }
    .btn-confirm-delete {
      background: var(--red); color: #fff; border: 1px solid var(--red);
    }
    .btn-confirm-delete:hover { opacity: 0.85; }

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
  @state() private showDeleteConfirm = false;
  @state() private collapsedDirs = new Set<string>();
  @state() private selecting = false;
  @state() private selectedPaths = new Set<string>();
  @state() private showBatchDeleteConfirm = false;

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
        const res = await fetch(api.mediaUrl(f.path));
        this.fileText = await res.text();
      } catch (e: any) {
        this.error = e.message;
      }
    }
  }

  private toggleDir(dir: string) {
    const next = new Set(this.collapsedDirs);
    if (next.has(dir)) next.delete(dir);
    else next.add(dir);
    this.collapsedDirs = next;
  }

  private getDirFiles(dir: string): any[] {
    return this.files.filter((f: any) => {
      const idx = f.path.lastIndexOf("/");
      return (idx === -1 ? "" : f.path.substring(0, idx)) === dir;
    });
  }

  private isDirAllSelected(dir: string): boolean {
    const dirFiles = this.getDirFiles(dir);
    return dirFiles.length > 0 && dirFiles.every((f: any) => this.selectedPaths.has(f.path));
  }

  private toggleDirSelect(dir: string) {
    const dirFiles = this.getDirFiles(dir);
    const next = new Set(this.selectedPaths);
    if (this.isDirAllSelected(dir)) {
      for (const f of dirFiles) next.delete(f.path);
    } else {
      for (const f of dirFiles) next.add(f.path);
    }
    this.selectedPaths = next;
  }

  private goBackToList() {
    this.mobileShowDetail = false;
  }

  private confirmDelete() {
    if (!this.selected) return;
    this.showDeleteConfirm = true;
  }

  private cancelDelete() {
    this.showDeleteConfirm = false;
  }

  async doDelete() {
    if (!this.selected) return;
    this.showDeleteConfirm = false;
    try {
      await api.deleteMediaFile(this.selected.path);
      this.selected = null;
      this.mobileShowDetail = false;
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private enterSelectMode() {
    this.selecting = true;
    this.selectedPaths = new Set();
  }

  private exitSelectMode() {
    this.selecting = false;
    this.selectedPaths = new Set();
  }

  private toggleSelect(path: string) {
    const next = new Set(this.selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this.selectedPaths = next;
  }

  private selectAll() {
    if (this.selectedPaths.size === this.files.length) {
      this.selectedPaths = new Set();
    } else {
      this.selectedPaths = new Set(this.files.map((f: any) => f.path));
    }
  }

  private confirmBatchDelete() {
    if (!this.selectedPaths.size) return;
    this.showBatchDeleteConfirm = true;
  }

  private cancelBatchDelete() {
    this.showBatchDeleteConfirm = false;
  }

  async doBatchDelete() {
    if (!this.selectedPaths.size) return;
    this.showBatchDeleteConfirm = false;
    try {
      await api.batchDeleteMedia([...this.selectedPaths]);
      if (this.selected && this.selectedPaths.has(this.selected.path)) {
        this.selected = null;
        this.mobileShowDetail = false;
      }
      this.exitSelectMode();
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private typeIcon(type: string): string {
    const icons: Record<string, string> = {
      image: "🖼", audio: "🎵", video: "🎬", text: "📄", pdf: "📕",
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
    if (!this.selected) return html`<div class="empty">${t("media.selectToPreview")}</div>`;
    const url = api.mediaUrl(this.selected.path);
    switch (this.selected.type) {
      case "image":
        return html`<img src=${url} alt=${this.selected.name} />`;
      case "audio":
        return html`<audio controls src=${url}></audio>`;
      case "video":
        return html`<video controls src=${url}></video>`;
      case "pdf":
        return html`<iframe class="pdf-preview" src=${url}></iframe>`;
      case "text":
        if (this.selected.name.endsWith(".md")) {
          return html`<div class="md-preview">${unsafeHTML(renderMarkdown(this.fileText))}</div>`;
        }
        return html`<pre>${this.fileText}</pre>`;
      default:
        return html`<div class="empty">
          <div style="font-size:32px;margin-bottom:12px">📦</div>
          <div>${this.selected.mime}</div>
          <div style="margin-top:8px"><a href=${url} download style="color:var(--blue)">${t("common.download")}</a></div>
        </div>`;
    }
  }

  private renderFileItem(f: any) {
    const isImage = f.type === "image";
    const checked = this.selectedPaths.has(f.path);
    return html`
      <div
        class="file-item ${this.selected?.path === f.path && !this.selecting ? "active" : ""}"
        @click=${() => this.selecting ? this.toggleSelect(f.path) : this.selectFile(f)}
      >
        ${this.selecting ? html`
          <div class="checkbox ${checked ? "checked" : ""}">✓</div>
        ` : ""}
        <div class="file-icon ${f.type}">
          ${isImage
            ? html`<img src="${api.mediaUrl(f.path)}" alt="${f.name}" loading="lazy" />`
            : this.typeIcon(f.type)}
        </div>
        <div class="file-info">
          <div class="file-name">${f.name}</div>
          <div class="file-meta">
            <span>${this.formatSize(f.size)}</span>
            <span>${f.mime}</span>
          </div>
        </div>
      </div>
    `;
  }

  private renderFileList() {
    // Group files by directory
    const groups = new Map<string, any[]>();
    for (const f of this.files) {
      const idx = f.path.lastIndexOf("/");
      const dir = idx === -1 ? "" : f.path.substring(0, idx);
      if (!groups.has(dir)) groups.set(dir, []);
      groups.get(dir)!.push(f);
    }

    const result: any[] = [];

    // Root files first (no directory)
    const rootFiles = groups.get("") || [];
    for (const f of rootFiles) result.push(this.renderFileItem(f));

    // Then subdirectories
    for (const [dir, files] of groups) {
      if (dir === "") continue;
      const collapsed = this.collapsedDirs.has(dir);
      const dirAllSelected = this.selecting && this.isDirAllSelected(dir);
      result.push(html`
        <div class="dir-header">
          ${this.selecting ? html`
            <div class="checkbox ${dirAllSelected ? "checked" : ""}"
              @click=${(e: Event) => { e.stopPropagation(); this.toggleDirSelect(dir); }}>✓</div>
          ` : ""}
          <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0"
            @click=${() => this.toggleDir(dir)}>
            <span class="dir-arrow ${collapsed ? "collapsed" : ""}">▼</span>
            <span>📁 ${dir}/</span>
            <span style="color:var(--text-muted);font-weight:400">${files.length}</span>
          </div>
        </div>
      `);
      if (!collapsed) {
        for (const f of files) result.push(this.renderFileItem(f));
      }
    }

    return result;
  }

  render() {
    return html`
      <div class="page-header">
        <h1>${t("media.title")}</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="${t("common.refresh")}">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="layout">
        <div class="list-panel ${this.mobileShowDetail ? "hidden" : ""}">
          ${this.selecting ? html`
            <div class="select-bar">
              <button class="sel-btn ${this.selectedPaths.size === this.files.length ? "active" : ""}"
                @click=${this.selectAll}>${t("media.selectAll")}</button>
              <div class="spacer"></div>
              ${this.selectedPaths.size ? html`
                <button class="sel-btn danger" @click=${this.confirmBatchDelete}>
                  ${t("media.batchDelete").replace("{0}", String(this.selectedPaths.size))}
                </button>
              ` : ""}
              <button class="sel-btn" @click=${this.exitSelectMode}>${t("media.cancelSelect")}</button>
            </div>
          ` : html`
            <div class="select-bar">
              <span style="font-size:12px;color:var(--text-muted);font-weight:600">${this.files.length}${t("media.fileCount")}</span>
              <div class="spacer"></div>
              <button class="sel-btn" @click=${this.enterSelectMode}>${t("media.select")}</button>
            </div>
          `}
          <div class="file-list">${this.renderFileList()}</div>
        </div>
        <div class="preview-panel ${!this.mobileShowDetail ? "hidden" : ""}">
          ${!this.selected
            ? html`<div class="empty">${t("media.selectToPreview")}</div>`
            : html`
                <div class="preview-header">
                  <div style="display:flex;align-items:center;min-width:0">
                    <button class="back-btn" @click=${this.goBackToList}>${t("common.back")}</button>
                    <h2>${this.selected.path}</h2>
                  </div>
                  <button class="delete-btn" @click=${this.confirmDelete}>${t("common.delete")}</button>
                </div>
                <div class="preview-body">
                  ${this.renderPreview()}
                </div>
              `}
        </div>
      </div>
      ${this.showDeleteConfirm ? html`
        <div class="dialog-overlay">
          <div class="dialog">
            <h3>${t("media.deleteTitle")}</h3>
            <p>${t("media.deleteConfirm")} "${this.selected?.path}"？${t("media.deleteNote")}</p>
            <div class="dialog-actions">
              <button class="btn-cancel" @click=${this.cancelDelete}>${t("common.cancel")}</button>
              <button class="btn-confirm-delete" @click=${this.doDelete}>${t("common.delete")}</button>
            </div>
          </div>
        </div>
      ` : ""}
      ${this.showBatchDeleteConfirm ? html`
        <div class="dialog-overlay">
          <div class="dialog">
            <h3>${t("media.deleteTitle")}</h3>
            <p>${t("media.batchDeleteConfirm").replace("{0}", String(this.selectedPaths.size))} ${t("media.deleteNote")}</p>
            <div class="dialog-actions">
              <button class="btn-cancel" @click=${this.cancelBatchDelete}>${t("common.cancel")}</button>
              <button class="btn-confirm-delete" @click=${this.doBatchDelete}>${t("common.delete")}</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }
}
