/**
 * Base class for file viewer pages (Memory, Knowledge).
 * Subclasses set `pageTitle`, `groups`, and `groupLabels`.
 */
import { LitElement, html, css, unsafeCSS } from "lit";
import { state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api } from "../api/client.js";
import { renderMarkdown, highlightFile } from "../utils/markdown.js";
import { hljsThemeCSS as hljsStyles } from "../utils/hljs-theme.js";
import { t } from "../i18n.js";

export abstract class FileViewer extends LitElement {
  abstract readonly pageTitle: string;
  abstract groups: string[];
  abstract groupLabels: Record<string, string>;
  abstract readonly pageId: string;

  @state() protected files: any[] = [];
  @state() protected selectedPath = "";
  @state() protected content = "";
  @state() protected editing = false;
  @state() protected editContent = "";
  @state() protected error = "";
  @state() protected saving = false;
  @state() protected refreshing = false;
  @state() private collapsedDirs: Set<string> = new Set();
  @state() private showDeleteConfirm = false;
  @state() protected sortMode: "name" | "time-asc" | "time-desc" = "name";
  @state() private mobileShowDetail = false;
  @state() protected selecting = false;
  @state() protected selectedPaths = new Set<string>();
  @state() private showBatchDeleteConfirm = false;

  /** Override to true to show sort controls */
  protected showSortControls = false;

  private get _sortStorageKey() {
    return `nanobot-sort-${this.groups.join(",")}`;
  }

  private _setSortMode(mode: "name" | "time-asc" | "time-desc") {
    this.sortMode = mode;
    try { localStorage.setItem(this._sortStorageKey, mode); } catch {}
  }

  private _loadSortMode() {
    try {
      const v = localStorage.getItem(this._sortStorageKey);
      if (v === "name" || v === "time-asc" || v === "time-desc") this.sortMode = v;
    } catch {}
  }

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
    .tree-list { flex: 1; overflow-y: auto; }

    .sort-bar {
      display: flex; align-items: center; gap: 4px;
      padding: 8px 12px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface);
    }
    .sort-btn {
      padding: 4px 10px; font-size: 11px; font-weight: 500;
      border: 1px solid var(--border-default); border-radius: var(--r-sm);
      background: transparent; color: var(--text-muted);
      cursor: pointer; font-family: var(--font-sans);
      transition: all 0.15s var(--ease);
    }
    .sort-btn:hover { color: var(--text-secondary); border-color: var(--text-muted); }
    .sort-btn.active {
      color: var(--green); border-color: var(--green);
      background: var(--green-glow);
    }
    .sort-bar .spacer { flex: 1; }

    /* ---- Select Mode ---- */
    .sort-bar .sel-btn {
      padding: 4px 10px; font-size: 11px; font-weight: 500;
      border: 1px solid var(--border-default); border-radius: var(--r-sm);
      background: transparent; color: var(--text-muted);
      cursor: pointer; font-family: var(--font-sans);
      transition: all 0.15s var(--ease);
    }
    .sort-bar .sel-btn:hover { color: var(--text-secondary); border-color: var(--text-muted); }
    .sort-bar .sel-btn.active {
      color: var(--green); border-color: var(--green); background: var(--green-glow);
    }
    .sort-bar .sel-btn.danger {
      color: var(--red); border-color: var(--red-soft);
    }
    .sort-bar .sel-btn.danger:hover { background: var(--red-soft); }
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

    .tree-group {
      padding: 10px 16px 6px; font-size: 10px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 1.2px; color: var(--green);
      background: var(--bg-surface); border-bottom: 1px solid var(--border-subtle);
      position: sticky; top: 0; z-index: 1;
    }
    .tree-dir {
      padding: 7px 16px; font-size: 12px; font-weight: 600;
      color: var(--text-secondary); cursor: pointer; user-select: none;
      display: flex; align-items: center; gap: 6px;
      transition: all 0.12s var(--ease);
      margin: 2px 8px; border-radius: var(--r-sm);
      background: var(--bg-surface);
    }
    .tree-dir:hover { color: var(--text-primary); background: var(--bg-elevated); }
    .tree-dir .chevron {
      font-size: 10px; transition: transform 0.15s var(--ease);
      display: inline-block; width: 12px; text-align: center;
      color: var(--text-muted);
    }
    .tree-dir .chevron.collapsed { transform: rotate(-90deg); }
    .tree-dir .dir-icon { font-size: 13px; opacity: 0.8; }

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
      align-items: center; gap: 8px;
    }
    .tree-item:hover { background: var(--bg-elevated); color: var(--text-primary); }
    .tree-item.active {
      background: var(--bg-elevated);
      border-left: 3px solid var(--green);
      color: var(--text-primary);
    }
    .tree-item .path { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; }
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
      padding: 14px 20px; gap: 10px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
    }
    .content-header h2 {
      flex: 1; min-width: 0;
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

    /* Image preview */
    .image-preview {
      display: flex; align-items: center; justify-content: center;
      min-height: 200px;
    }
    .image-preview img {
      max-width: 100%; max-height: calc(100vh - 220px); object-fit: contain;
      border-radius: var(--r-sm);
    }

    /* PDF preview */
    .pdf-preview {
      width: 100%; height: calc(100vh - 220px); min-height: 400px;
    }
    .pdf-preview iframe {
      width: 100%; height: 100%; border: none; border-radius: var(--r-sm);
    }

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
    .back-btn {
      display: none; padding: 4px 10px; font-size: 12px; font-weight: 500;
      background: var(--bg-elevated); color: var(--text-secondary);
      border: 1px solid var(--border-default); border-radius: var(--r-sm);
      cursor: pointer; font-family: var(--font-sans);
      transition: all 0.15s var(--ease);
    }
    .back-btn:hover { color: var(--text-primary); border-color: var(--text-muted); }
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

    @media (max-width: 768px) {
      h1 { font-size: 20px; }
      .layout { flex-direction: column; height: auto; min-height: calc(100vh - 110px); }
      .tree-panel { width: 100%; max-height: 100%; flex-shrink: 0; }
      .content-panel { flex: 1; min-height: 60vh; }
      .tree-panel.hidden { display: none; }
      .content-panel.hidden { display: none; }
      .back-btn { display: inline-block; }
      .editor-area { min-height: 200px; }
      .content-body { padding: 14px 16px; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadSortMode();
    this.load().then(() => {
      const filePath = this._getFilePathFromHash();
      if (filePath) {
        this._expandDirsForFile(filePath);
        this.selectFile(filePath, false);
      }
    });
    window.addEventListener("dashboard-file-navigate", this._onFileNavigate as EventListener);
    window.addEventListener("hashchange", this._onHashChangeFileViewer);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener("dashboard-file-navigate", this._onFileNavigate as EventListener);
    window.removeEventListener("hashchange", this._onHashChangeFileViewer);
    window.dispatchEvent(new CustomEvent("dashboard-file-select", { detail: { path: null } }));
  }

  private _onFileNavigate = (e: CustomEvent<{ path: string }>) => {
    const path = e.detail.path;
    // Only handle if this viewer owns the file's group
    const file = this.files.find((f: any) => f.path === path);
    if (file) {
      this.selectFile(path);
    } else {
      // File may not be loaded yet — reload and try again
      this.load().then(() => {
        const found = this.files.find((f: any) => f.path === path);
        if (found) this.selectFile(path);
      });
    }
  };

  private _getFilePathFromHash(): string {
    const hash = location.hash.slice(1);
    const slash = hash.indexOf("/");
    if (slash < 0) return "";
    const page = hash.substring(0, slash);
    if (page !== this.pageId) return "";
    return hash.substring(slash + 1);
  }

  private _expandDirsForFile(path: string) {
    const file = this.files.find((f: any) => f.path === path);
    if (!file) return;
    const parts = path.split("/");
    let dir = parts.length > 2 ? parts.slice(1, -1).join("/") : "";
    if (dir === file.group) dir = "";
    if (!dir) return;
    const dirKey = `${file.group}/${dir}`;
    if (this.collapsedDirs.has(dirKey)) {
      const next = new Set(this.collapsedDirs);
      next.delete(dirKey);
      this.collapsedDirs = next;
    }
  }

  private _onHashChangeFileViewer = () => {
    const filePath = this._getFilePathFromHash();
    if (filePath && filePath !== this.selectedPath) {
      this._expandDirsForFile(filePath);
      this.selectFile(filePath, false);
    } else if (!filePath && this.selectedPath) {
      this.selectedPath = "";
      this.content = "";
      this.editing = false;
      window.dispatchEvent(new CustomEvent("dashboard-file-select", { detail: { path: null } }));
    }
  };

  private _onContentClick = (e: MouseEvent) => {
    const anchor = (e.target as HTMLElement).closest?.("a") as HTMLAnchorElement | null;
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (!href) return;
    if (/^(https?|mailto|tel):/.test(href)) return;
    e.preventDefault();
    // Handle hash links like #workspace/path or #knowledge/path
    if (href.startsWith("#")) {
      location.hash = href.slice(1);
      return;
    }
    const filePath = href.startsWith("/") ? href.slice(1) : href;
    const page = filePath.startsWith("memory/knowledge/") ? "knowledge" : "workspace";
    location.hash = `${page}/${filePath}`;
  };

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
      // Default-collapse all subdirectories on first load
      if (this.collapsedDirs.size === 0 && this.files.length) {
        this.initCollapsedDirs();
      }
    } catch (e: any) {
      this.error = e.message;
    }
  }

  protected initCollapsedDirs() {
    const dirs = new Set<string>();
    const sections = this.groupBySection();
    for (const g of this.groups) {
      const items = sections[g];
      if (!items?.length) continue;
      const subs = this.subGroup(items, g);
      for (const sub of subs) {
        if (sub.dir) dirs.add(`${g}/${sub.dir}`);
      }
    }
    if (dirs.size) this.collapsedDirs = dirs;
  }

  private goBackToList() {
    this.mobileShowDetail = false;
  }

  private static IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"]);
  private static PDF_EXT = "pdf";

  private isImage(path: string): boolean {
    return FileViewer.IMAGE_EXTS.has(this.getExt(path).toLowerCase());
  }

  private isPdf(path: string): boolean {
    return this.getExt(path).toLowerCase() === FileViewer.PDF_EXT;
  }

  async selectFile(path: string, updateHash = true) {
    this.selectedPath = path;
    this.editing = false;
    this.mobileShowDetail = true;
    this.content = "";
    if (!this.isImage(path) && !this.isPdf(path)) {
      try {
        const res = await api.getMemoryFile(path);
        this.content = res.content;
      } catch (e: any) {
        this.error = e.message;
      }
    }
    if (updateHash) {
      history.replaceState(null, "", `#${this.pageId}/${path}`);
    }
    window.dispatchEvent(new CustomEvent("dashboard-file-select", { detail: { path } }));
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
      history.replaceState(null, "", `#${this.pageId}`);
      await this.load();
      window.dispatchEvent(new CustomEvent("dashboard-file-select", { detail: { path: null } }));
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

  private enterSelectMode = () => {
    this.selecting = true;
    this.selectedPaths = new Set();
  };

  private exitSelectMode = () => {
    this.selecting = false;
    this.selectedPaths = new Set();
  };

  private toggleSelect = (path: string) => {
    const next = new Set(this.selectedPaths);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    this.selectedPaths = next;
  };

  private selectAllFiles = () => {
    if (this.selectedPaths.size === this.files.length) {
      this.selectedPaths = new Set();
    } else {
      this.selectedPaths = new Set(this.files.map((f: any) => f.path));
    }
  };

  private getDirFiles(dirKey: string, groupKey: string): any[] {
    return this.files.filter((f: any) => {
      if (f.group !== groupKey) return false;
      const parts = f.path.split("/");
      let dir = parts.length > 2 ? parts.slice(1, -1).join("/") : "";
      if (dir === groupKey) dir = "";
      return dir === dirKey;
    });
  }

  private isDirAllSelected(dirKey: string, groupKey: string): boolean {
    const dirFiles = this.getDirFiles(dirKey, groupKey);
    return dirFiles.length > 0 && dirFiles.every((f: any) => this.selectedPaths.has(f.path));
  }

  private toggleDirSelect(dirKey: string, groupKey: string) {
    const dirFiles = this.getDirFiles(dirKey, groupKey);
    const next = new Set(this.selectedPaths);
    if (this.isDirAllSelected(dirKey, groupKey)) {
      for (const f of dirFiles) next.delete(f.path);
    } else {
      for (const f of dirFiles) next.add(f.path);
    }
    this.selectedPaths = next;
  }

  private confirmBatchDelete = () => {
    if (!this.selectedPaths.size) return;
    this.showBatchDeleteConfirm = true;
  };

  private cancelBatchDelete = () => {
    this.showBatchDeleteConfirm = false;
  };

  private doBatchDelete = async () => {
    if (!this.selectedPaths.size) return;
    this.showBatchDeleteConfirm = false;
    try {
      await api.batchDeleteMemoryFiles([...this.selectedPaths]);
      if (this.selectedPaths.has(this.selectedPath)) {
        this.selectedPath = "";
        this.content = "";
        this.editing = false;
        history.replaceState(null, "", `#${this.pageId}`);
        window.dispatchEvent(new CustomEvent("dashboard-file-select", { detail: { path: null } }));
      }
      this.exitSelectMode();
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    }
  };

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

  private groupBySection() {
    const sections: Record<string, any[]> = {};
    for (const f of this.files) {
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
      let dir = parts.length > 2 ? parts.slice(1, -1).join("/") : "";
      // Strip top-level dir that matches the group name (e.g. "knowledge" in knowledge page)
      if (dir === groupKey) dir = "";
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

  private sortFiles(files: any[] | undefined): any[] | undefined {
    if (!files || this.sortMode === "name") return files;
    const sorted = [...files];
    sorted.sort((a, b) => {
      const ta = a.mtime || 0, tb = b.mtime || 0;
      return this.sortMode === "time-desc" ? tb - ta : ta - tb;
    });
    return sorted;
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
    if (this.isImage(this.selectedPath)) {
      return html`<div class="image-preview"><img src="${api.memoryRawUrl(this.selectedPath)}" alt="${this.selectedPath}" /></div>`;
    }
    if (this.isPdf(this.selectedPath)) {
      return html`<div class="pdf-preview"><iframe src="${api.memoryRawUrl(this.selectedPath)}"></iframe></div>`;
    }
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
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="${t("common.refresh")}">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="layout">
        <div class="tree-panel ${this.mobileShowDetail ? "hidden" : ""}">
          ${this.selecting ? html`
            <div class="sort-bar">
              <button class="sel-btn ${this.selectedPaths.size === this.files.length ? "active" : ""}"
                @click=${this.selectAllFiles}>${t("fileViewer.selectAll")}</button>
              <div class="spacer"></div>
              ${this.selectedPaths.size ? html`
                <button class="sel-btn danger" @click=${this.confirmBatchDelete}>
                  ${t("fileViewer.batchDelete").replace("{0}", String(this.selectedPaths.size))}
                </button>
              ` : ""}
              <button class="sel-btn" @click=${this.exitSelectMode}>${t("fileViewer.cancelSelect")}</button>
            </div>
          ` : html`
            <div class="sort-bar">
              ${this.showSortControls ? html`
                <button class="sort-btn ${this.sortMode === "name" ? "active" : ""}"
                  @click=${() => this._setSortMode("name")}>${t("common.name")}</button>
                <button class="sort-btn ${this.sortMode === "time-desc" ? "active" : ""}"
                  @click=${() => this._setSortMode("time-desc")}>${t("common.newest")}</button>
                <button class="sort-btn ${this.sortMode === "time-asc" ? "active" : ""}"
                  @click=${() => this._setSortMode("time-asc")}>${t("common.oldest")}</button>
              ` : html`
                <span style="font-size:12px;color:var(--text-muted);font-weight:600">${this.files.length}${t("fileViewer.fileCount")}</span>
              `}
              <div class="spacer"></div>
              <button class="sel-btn" @click=${this.enterSelectMode}>${t("fileViewer.select")}</button>
            </div>
          `}
          <div class="tree-list">
            ${this.groups.map((g) => {
              const items = this.sortFiles(sections[g]);
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
                    (f: any) => {
                      const checked = this.selectedPaths.has(f.path);
                      return html`
                        <div
                          class="tree-item ${!this.selecting && this.selectedPath === f.path ? "active" : ""}"
                          @click=${() => this.selecting ? this.toggleSelect(f.path) : this.selectFile(f.path)}
                        >
                          ${this.selecting ? html`<div class="checkbox ${checked ? "checked" : ""}">✓</div>` : ""}
                          <span class="path">${f.name}</span>
                          <span class="size">${this.formatSize(f.sizeBytes)}</span>
                        </div>
                      `;
                    }
                  );
                  return html`
                    ${sub.dir
                      ? html`
                          <div class="tree-dir">
                            ${this.selecting ? html`
                              <div class="checkbox ${this.isDirAllSelected(sub.dir, g) ? "checked" : ""}"
                                @click=${(e: Event) => { e.stopPropagation(); this.toggleDirSelect(sub.dir, g); }}>✓</div>
                            ` : ""}
                            <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:0"
                              @click=${() => this.toggleDir(dirKey)}>
                              <span class="chevron ${isCollapsed ? "collapsed" : ""}">▶</span>
                              <span class="dir-icon">📁</span>
                              ${sub.dir}/
                            </div>
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
        <div class="content-panel ${!this.mobileShowDetail ? "hidden" : ""}">
          ${!this.selectedPath
            ? html`<div class="empty">${t("fileViewer.selectFile")}</div>`
            : html`
                <div class="content-header">
                  <button class="back-btn" @click=${this.goBackToList}>${t("common.back")}</button>
                  <h2>${this.selectedPath}</h2>
                  <div class="actions">
                    ${this.editing
                      ? html`
                          <button class="btn btn-cancel" @click=${this.cancelEdit}>${t("common.cancel")}</button>
                          <button class="btn btn-save" @click=${this.saveEdit} ?disabled=${this.saving}>
                            ${this.saving ? t("common.saving") : t("common.save")}
                          </button>
                        `
                      : html`
                          <button class="btn btn-delete" @click=${this.confirmDeleteFile}>${t("common.delete")}</button>
                          ${!this.isImage(this.selectedPath) ? html`
                            <button class="btn btn-edit" @click=${this.startEdit}>${t("common.edit")}</button>
                          ` : ""}
                        `}
                  </div>
                </div>
                <div class="content-body" @click=${this._onContentClick}>
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
            <h3>${t("fileViewer.deleteTitle")}</h3>
            <p>${t("fileViewer.deleteConfirm")} "${this.selectedPath.split("/").pop() || this.selectedPath}"？</p>
            <div class="dialog-actions">
              <button class="btn-cancel" @click=${this.cancelDelete}>${t("common.cancel")}</button>
              <button class="btn-confirm-delete" @click=${this.doDeleteFile}>${t("common.delete")}</button>
            </div>
          </div>
        </div>
      ` : ""}
      ${this.showBatchDeleteConfirm ? html`
        <div class="dialog-overlay">
          <div class="dialog">
            <h3>${t("fileViewer.deleteTitle")}</h3>
            <p>${t("fileViewer.batchDeleteConfirm").replace("{0}", String(this.selectedPaths.size))}</p>
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
