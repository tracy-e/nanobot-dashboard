/**
 * Base class for file viewer pages (Memory, Knowledge).
 * Subclasses set `pageTitle`, `groups`, and `groupLabels`.
 */
import { LitElement, html, css, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api } from "../api/client.js";
import { renderMarkdown, highlightFile } from "../utils/markdown.js";
import hljsStyles from "highlight.js/styles/github-dark.css?inline";

export abstract class FileViewer extends LitElement {
  abstract readonly pageTitle: string;
  abstract groups: string[];
  abstract groupLabels: Record<string, string>;

  @state() protected files: any[] = [];
  @state() protected selectedPath = "";
  @state() protected content = "";
  @state() protected editing = false;
  @state() protected editContent = "";
  @state() protected error = "";
  @state() protected saving = false;
  @state() protected searchQuery = "";
  @state() protected refreshing = false;
  @state() private collapsedDirs: Set<string> = new Set();
  @state() private showDeleteConfirm = false;

  static styles = css`
    ${unsafeCSS(hljsStyles)}

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

    /* ---- Tree Panel ---- */
    .tree-panel {
      width: 270px; flex-shrink: 0; overflow-y: auto;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); box-shadow: var(--shadow-card);
      display: flex; flex-direction: column;
    }
    .search-box {
      padding: 12px 14px; border-bottom: 1px solid var(--border-subtle); flex-shrink: 0;
    }
    .search-box input {
      width: 100%; background: var(--bg-input); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); padding: 8px 12px; color: var(--text-primary);
      font-size: 12px; font-family: var(--font-sans);
      transition: border-color 0.15s var(--ease);
    }
    .search-box input::placeholder { color: var(--text-muted); }
    .search-box input:focus { outline: none; border-color: var(--green); }

    .tree-list { flex: 1; overflow-y: auto; }

    .tree-group {
      padding: 10px 16px 6px; font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.2px; color: var(--green);
      background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
      position: sticky; top: 0; z-index: 1;
    }
    .tree-dir {
      padding: 6px 16px 6px 16px; font-size: 12px; font-weight: 600;
      color: var(--text-secondary); cursor: pointer; user-select: none;
      display: flex; align-items: center; gap: 6px;
      transition: color 0.12s var(--ease);
    }
    .tree-dir:hover { color: var(--text-primary); }
    .tree-dir .chevron {
      font-size: 10px; transition: transform 0.15s var(--ease);
      display: inline-block; width: 12px; text-align: center;
    }
    .tree-dir .chevron.collapsed { transform: rotate(-90deg); }
    .tree-dir .dir-icon { font-size: 13px; opacity: 0.7; }

    /* Directory children container — tree guide line */
    .dir-children {
      margin-left: 22px;
      border-left: 1px solid var(--border-default);
    }
    .dir-children .tree-item { padding-left: 14px; }
    .dir-children .tree-item.active { border-left: 2px solid var(--green); }

    .tree-item {
      padding: 8px 16px 8px 16px; font-size: 13px; cursor: pointer;
      color: var(--text-secondary); border-bottom: 1px solid var(--border-subtle);
      transition: all 0.12s var(--ease); display: flex;
      justify-content: space-between; align-items: center;
    }
    .tree-item:hover { background: var(--bg-elevated); color: var(--text-primary); }
    .tree-item.active {
      background: var(--bg-elevated);
      border-left: 3px solid var(--green);
      color: var(--text-primary);
    }
    .tree-item .path { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
    .tree-item .size {
      font-size: 10px; color: var(--text-muted); flex-shrink: 0;
      margin-left: 8px; font-family: var(--font-mono);
    }

    /* ---- Content Panel ---- */
    .content-panel {
      flex: 1; display: flex; flex-direction: column;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    .content-header {
      display: flex; justify-content: space-between; align-items: center;
      padding: 14px 20px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .content-header h2 {
      font-size: 13px; color: var(--text-primary); font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      font-family: var(--font-mono);
    }
    .content-body {
      flex: 1; overflow-y: auto; padding: 22px 26px;
      font-size: 14px; line-height: 1.7; color: var(--text-secondary);
    }

    /* Markdown preview */
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
      overflow-x: auto; margin: 10px 0; font-size: 13px; line-height: 1.5;
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

    /* Code-only preview */
    .code-preview pre {
      background: var(--bg-input); border: 1px solid var(--border-subtle);
      border-radius: var(--r-sm); padding: 14px 16px;
      overflow-x: auto; margin: 0; font-size: 13px; line-height: 1.5;
    }
    .code-preview code { font-family: var(--font-mono); }

    /* Editor */
    .editor-area {
      width: 100%; height: 100%; min-height: 500px;
      background: var(--bg-input); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); padding: 14px 16px;
      color: var(--text-primary); font-size: 13px; line-height: 1.6;
      font-family: var(--font-mono); resize: vertical; tab-size: 2;
      transition: border-color 0.15s var(--ease);
    }
    .editor-area:focus { outline: none; border-color: var(--green); }

    /* Buttons */
    .btn {
      padding: 7px 16px; border-radius: var(--r-sm); font-size: 12.5px;
      cursor: pointer; border: 1px solid var(--border-default);
      font-family: var(--font-sans); font-weight: 500;
      transition: all 0.18s var(--ease);
    }
    .btn-edit { background: transparent; color: var(--blue); border-color: var(--blue-soft); }
    .btn-edit:hover { background: var(--blue-soft); }
    .btn-delete { background: transparent; color: var(--red); border-color: var(--red-soft); }
    .btn-delete:hover { background: var(--red-soft); }
    .btn-save { background: var(--green); color: #fff; border-color: var(--green); }
    .btn-save:hover { background: var(--green-dim); box-shadow: 0 0 12px rgba(74,222,128,0.2); }
    .btn-cancel { background: transparent; color: var(--text-muted); }
    .btn-cancel:hover { color: var(--text-secondary); }
    .actions { display: flex; gap: 8px; }
    .empty { color: var(--text-muted); text-align: center; padding: 48px; font-size: 13px; }
    .error { color: var(--red); margin-bottom: 12px; font-size: 13px; }

    /* ---- Delete Confirm Dialog ---- */
    .dialog-overlay {
      position: fixed; inset: 0; z-index: 1000;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
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

    @media (max-width: 768px) {
      h1 { font-size: 20px; }
      .layout { flex-direction: column; height: auto; min-height: calc(100vh - 110px); }
      .tree-panel { width: 100%; max-height: 40vh; flex-shrink: 0; }
      .content-panel { flex: 1; min-height: 50vh; }
      .editor-area { min-height: 200px; }
      .content-body { padding: 14px 16px; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this.load();
  }

  async refresh() {
    this.refreshing = true;
    await this.load();
    if (this.selectedPath) {
      try {
        const res = await api.getMemoryFile(this.selectedPath);
        this.content = res.content;
      } catch { /* file may have been deleted */ }
    }
    this.refreshing = false;
  }

  async load() {
    try {
      const res = await api.getMemoryFiles();
      const allowed = new Set(this.groups);
      this.files = (res.files || []).filter((f: any) => allowed.has(f.group));
    } catch (e: any) {
      this.error = e.message;
    }
  }

  async selectFile(path: string) {
    this.selectedPath = path;
    this.editing = false;
    try {
      const res = await api.getMemoryFile(path);
      this.content = res.content;
    } catch (e: any) {
      this.error = e.message;
    }
  }

  startEdit() {
    this.editContent = this.content;
    this.editing = true;
  }

  cancelEdit() { this.editing = false; }

  private confirmDeleteFile() {
    if (!this.selectedPath) return;
    this.showDeleteConfirm = true;
  }

  private cancelDelete() {
    this.showDeleteConfirm = false;
  }

  async doDeleteFile() {
    if (!this.selectedPath) return;
    this.showDeleteConfirm = false;
    try {
      await api.deleteMemoryFile(this.selectedPath);
      this.selectedPath = "";
      this.content = "";
      this.editing = false;
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  async saveEdit() {
    this.saving = true;
    try {
      await api.updateMemoryFile(this.selectedPath, this.editContent);
      this.content = this.editContent;
      this.editing = false;
    } catch (e: any) {
      this.error = e.message;
    }
    this.saving = false;
  }

  protected handleTab(e: KeyboardEvent) {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.target as HTMLTextAreaElement;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      this.editContent =
        this.editContent.substring(0, start) + "  " + this.editContent.substring(end);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
  }

  private toggleDir(dirKey: string) {
    const next = new Set(this.collapsedDirs);
    if (next.has(dirKey)) {
      next.delete(dirKey);
    } else {
      next.add(dirKey);
    }
    this.collapsedDirs = next;
  }

  get filteredFiles() {
    if (!this.searchQuery) return this.files;
    const q = this.searchQuery.toLowerCase();
    return this.files.filter((f: any) => f.path.toLowerCase().includes(q));
  }

  private groupBySection() {
    const sections: Record<string, any[]> = {};
    for (const f of this.filteredFiles) {
      const g = f.group || "other";
      if (!sections[g]) sections[g] = [];
      sections[g].push(f);
    }
    return sections;
  }

  private subGroup(files: any[], groupKey: string) {
    const out: { dir: string; files: any[] }[] = [];
    let currentDir = "";
    let currentFiles: any[] = [];

    for (const f of files) {
      const parts = f.path.split("/");
      const dir =
        groupKey === "workspace"
          ? ""
          : parts.length > 2
          ? parts.slice(1, -1).join("/")
          : "";
      if (dir !== currentDir) {
        if (currentFiles.length) out.push({ dir: currentDir, files: currentFiles });
        currentDir = dir;
        currentFiles = [];
      }
      currentFiles.push(f);
    }
    if (currentFiles.length) out.push({ dir: currentDir, files: currentFiles });
    return out;
  }

  protected formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes}B`;
    return `${(bytes / 1024).toFixed(1)}K`;
  }

  private getExt(path: string): string {
    const dot = path.lastIndexOf(".");
    return dot >= 0 ? path.substring(dot + 1) : "";
  }

  protected renderContent() {
    const ext = this.getExt(this.selectedPath);
    if (ext === "md") {
      return html`<div class="md-preview">${unsafeHTML(renderMarkdown(this.content))}</div>`;
    }
    const langMap: Record<string, string> = {
      json: "json", jsonl: "json", txt: "plaintext",
      yaml: "yaml", yml: "yaml",
    };
    const lang = langMap[ext] || ext;
    return html`<div class="code-preview">${unsafeHTML(highlightFile(this.content, lang))}</div>`;
  }

  render() {
    const sections = this.groupBySection();
    const showGroupHeaders = this.groups.length > 1;

    return html`
      <div class="page-header">
        <h1>${this.pageTitle}</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="刷新">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="layout">
        <div class="tree-panel">
          <div class="search-box">
            <input
              placeholder="搜索文件..."
              .value=${this.searchQuery}
              @input=${(e: any) => (this.searchQuery = e.target.value)}
            />
          </div>
          <div class="tree-list">
            ${this.groups.map((g) => {
              const items = sections[g];
              if (!items?.length) return "";
              const subs = this.subGroup(items, g);
              return html`
                ${showGroupHeaders
                  ? html`<div class="tree-group">${this.groupLabels[g] || g}</div>`
                  : ""}
                ${subs.map((sub) => {
                  const dirKey = `${g}/${sub.dir}`;
                  const isCollapsed = this.collapsedDirs.has(dirKey);
                  const fileItems = sub.files.map(
                    (f: any) => html`
                      <div
                        class="tree-item ${this.selectedPath === f.path ? "active" : ""}"
                        @click=${() => this.selectFile(f.path)}
                      >
                        <span class="path">${f.name}</span>
                        <span class="size">${this.formatSize(f.sizeBytes)}</span>
                      </div>
                    `
                  );
                  return html`
                    ${sub.dir
                      ? html`
                          <div class="tree-dir" @click=${() => this.toggleDir(dirKey)}>
                            <span class="chevron ${isCollapsed ? "collapsed" : ""}">▾</span>
                            <span class="dir-icon">📁</span>
                            ${sub.dir}/
                          </div>
                          ${!isCollapsed ? html`<div class="dir-children">${fileItems}</div>` : ""}
                        `
                      : fileItems}
                  `;
                })}
              `;
            })}
          </div>
        </div>
        <div class="content-panel">
          ${!this.selectedPath
            ? html`<div class="empty">选择文件以查看</div>`
            : html`
                <div class="content-header">
                  <h2>${this.selectedPath}</h2>
                  <div class="actions">
                    ${this.editing
                      ? html`
                          <button class="btn btn-cancel" @click=${this.cancelEdit}>取消</button>
                          <button class="btn btn-save" @click=${this.saveEdit} ?disabled=${this.saving}>
                            ${this.saving ? "保存中..." : "保存"}
                          </button>
                        `
                      : html`
                          <button class="btn btn-delete" @click=${this.confirmDeleteFile}>删除</button>
                          <button class="btn btn-edit" @click=${this.startEdit}>编辑</button>
                        `}
                  </div>
                </div>
                <div class="content-body">
                  ${this.editing
                    ? html`<textarea
                        class="editor-area"
                        .value=${this.editContent}
                        @input=${(e: any) => (this.editContent = e.target.value)}
                        @keydown=${this.handleTab}
                      ></textarea>`
                    : this.renderContent()}
                </div>
              `}
        </div>
      </div>
      ${this.showDeleteConfirm ? html`
        <div class="dialog-overlay">
          <div class="dialog">
            <h3>删除文件</h3>
            <p>确定删除 "${this.selectedPath.split("/").pop() || this.selectedPath}"？</p>
            <div class="dialog-actions">
              <button class="btn-cancel" @click=${this.cancelDelete}>取消</button>
              <button class="btn-confirm-delete" @click=${this.doDeleteFile}>删除</button>
            </div>
          </div>
        </div>
      ` : ""}
    `;
  }
}
