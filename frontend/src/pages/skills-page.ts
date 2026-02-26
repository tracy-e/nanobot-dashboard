import { LitElement, html, css, unsafeCSS } from "lit";
import { customElement, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { api } from "../api/client.js";
import { renderMarkdown } from "../utils/markdown.js";
import hljsStyles from "highlight.js/styles/github-dark.css?inline";

@customElement("skills-page")
export class SkillsPage extends LitElement {
  @state() private skills: any[] = [];
  @state() private selected: any = null;
  @state() private fileContent = "";
  @state() private activeFile = "";
  @state() private editing = false;
  @state() private editContent = "";
  @state() private error = "";
  @state() private refreshing = false;
  @state() private saving = false;
  @state() private mobileShowDetail = false;

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

    /* ---- List Panel ---- */
    .list-panel {
      width: 290px; flex-shrink: 0; overflow-y: auto;
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); box-shadow: var(--shadow-card);
      display: flex; flex-direction: column;
    }
    .skill-item {
      padding: 14px 16px; border-bottom: 1px solid var(--border-subtle);
      cursor: pointer; transition: all 0.12s var(--ease);
    }
    .skill-item:hover { background: var(--bg-elevated); }
    .skill-item.active {
      background: var(--bg-elevated);
      border-left: 3px solid var(--green);
    }
    .skill-name { font-size: 14px; color: var(--text-primary); font-weight: 600; }
    .skill-desc {
      font-size: 12px; color: var(--text-muted); margin-top: 4px;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .skill-files { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
    .file-tag {
      font-size: 10px; padding: 2px 8px; border-radius: 6px;
      background: var(--bg-surface); color: var(--text-muted);
      border: 1px solid var(--border-subtle); font-weight: 500;
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
    .detail-header h2 { font-size: 14px; color: var(--text-primary); font-weight: 600; margin: 0; }
    .detail-header-left { display: flex; align-items: center; gap: 14px; min-width: 0; }

    .file-tabs { display: flex; gap: 4px; }
    .file-tab {
      padding: 5px 12px; border-radius: 6px; font-size: 11px;
      cursor: pointer; border: 1px solid var(--border-default);
      background: transparent; color: var(--text-muted);
      font-family: var(--font-sans); font-weight: 500;
      transition: all 0.15s var(--ease);
    }
    .file-tab.active {
      background: var(--green-soft); color: var(--green);
      border-color: rgba(74,222,128,0.25);
    }
    .file-tab:hover:not(.active) { background: var(--bg-hover); color: var(--text-secondary); }

    .detail-actions { display: flex; gap: 8px; flex-shrink: 0; }
    .detail-body {
      flex: 1; overflow-y: auto; padding: 22px 26px;
      font-size: 14px; line-height: 1.7; color: var(--text-secondary);
    }

    /* Markdown preview */
    .md-preview h1 { font-size: 20px; color: var(--text-primary); margin: 20px 0 10px; padding-bottom: 6px; border-bottom: 1px solid var(--border-default); font-weight: 700; }
    .md-preview h2 { font-size: 17px; color: var(--text-primary); margin: 18px 0 8px; padding-bottom: 4px; border-bottom: 1px solid var(--border-subtle); font-weight: 600; }
    .md-preview h3 { font-size: 15px; color: var(--text-primary); margin: 14px 0 6px; font-weight: 600; }
    .md-preview p { margin: 8px 0; }
    .md-preview a { color: var(--blue); text-decoration: none; }
    .md-preview a:hover { text-decoration: underline; }
    .md-preview ul, .md-preview ol { padding-left: 24px; margin: 6px 0; }
    .md-preview li { margin: 3px 0; }
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
    .md-preview th, .md-preview td { border: 1px solid var(--border-default); padding: 8px 12px; font-size: 13px; }
    .md-preview th { background: var(--bg-surface); color: var(--text-primary); font-weight: 600; }
    .md-preview strong { color: var(--text-primary); }
    .md-preview blockquote {
      border-left: 3px solid var(--green); padding: 6px 16px;
      margin: 8px 0; color: var(--text-muted); background: var(--green-glow);
      border-radius: 0 var(--r-sm) var(--r-sm) 0;
    }

    .editor-area {
      width: 100%; height: 100%; min-height: 500px;
      background: var(--bg-input); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); padding: 14px 16px;
      color: var(--text-primary); font-size: 13px; line-height: 1.6;
      font-family: var(--font-mono); resize: vertical; tab-size: 2;
      transition: border-color 0.15s var(--ease);
    }
    .editor-area:focus { outline: none; border-color: var(--green); }

    .btn {
      padding: 7px 16px; border-radius: var(--r-sm); font-size: 12.5px;
      cursor: pointer; border: 1px solid var(--border-default);
      font-family: var(--font-sans); font-weight: 500;
      transition: all 0.18s var(--ease);
    }
    .btn-edit { background: transparent; color: var(--blue); border-color: var(--blue-soft); }
    .btn-edit:hover { background: var(--blue-soft); }
    .btn-save { background: var(--green); color: #fff; border-color: var(--green); }
    .btn-save:hover { background: var(--green-dim); }
    .btn-cancel { background: transparent; color: var(--text-muted); }
    .btn-cancel:hover { color: var(--text-secondary); }
    .btn-danger { background: transparent; color: var(--red); border-color: var(--red-soft); }
    .btn-danger:hover { background: var(--red-soft); }
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
      .detail-panel { flex: 1; min-height: 60vh; }
      .list-panel.hidden { display: none; }
      .detail-panel.hidden { display: none; }
      .back-btn { display: inline-block; }
      .detail-body { padding: 14px 16px; }
      .editor-area { min-height: 200px; }
      .detail-header { flex-wrap: wrap; gap: 8px; }
      .detail-header-left { flex-wrap: wrap; }
      .file-tabs { flex-wrap: wrap; }
    }
    .stat {
      color: var(--text-muted); font-size: 12px; font-weight: 600;
      padding: 10px 16px; border-bottom: 1px solid var(--border-subtle);
      background: var(--bg-surface); flex-shrink: 0;
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
      const res = await api.getSkills();
      this.skills = res.skills || [];
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private goBackToList() {
    this.mobileShowDetail = false;
  }

  async selectSkill(s: any) {
    this.selected = s;
    this.editing = false;
    this.mobileShowDetail = true;
    const defaultFile = s.files.includes("SKILL.md") ? "SKILL.md" : s.files[0];
    if (defaultFile) {
      await this.loadFile(s.id, defaultFile);
    } else {
      this.fileContent = "";
      this.activeFile = "";
    }
  }

  async loadFile(skillId: string, filename: string) {
    this.activeFile = filename;
    this.editing = false;
    try {
      const res = await api.getSkillFile(skillId, filename);
      this.fileContent = res.content;
    } catch (e: any) {
      this.error = e.message;
    }
  }

  startEdit() {
    this.editContent = this.fileContent;
    this.editing = true;
  }

  cancelEdit() { this.editing = false; }

  async saveEdit() {
    if (!this.selected || !this.activeFile) return;
    this.saving = true;
    try {
      await api.updateSkillFile(this.selected.id, this.activeFile, this.editContent);
      this.fileContent = this.editContent;
      this.editing = false;
    } catch (e: any) {
      this.error = e.message;
    }
    this.saving = false;
  }

  async deleteSkill() {
    if (!this.selected) return;
    if (!confirm(`Delete skill "${this.selected.name}"? This removes the entire directory.`)) return;
    try {
      await api.deleteSkill(this.selected.id);
      this.selected = null;
      this.fileContent = "";
      this.activeFile = "";
      await this.load();
    } catch (e: any) {
      this.error = e.message;
    }
  }

  private renderFileContent() {
    if (!this.activeFile) return html`<div class="empty">No file selected</div>`;
    if (this.activeFile.endsWith(".md")) {
      return html`<div class="md-preview">${unsafeHTML(renderMarkdown(this.fileContent))}</div>`;
    }
    return html`<pre style="white-space:pre-wrap;word-break:break-word;margin:0;font-family:var(--font-mono);font-size:13px;line-height:1.6">${this.fileContent}</pre>`;
  }

  render() {
    return html`
      <div class="page-header">
        <h1>Skills</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="Refresh">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}
      <div class="layout">
        <div class="list-panel ${this.mobileShowDetail ? "hidden" : ""}">
          <div class="stat">${this.skills.length} skills</div>
          ${this.skills.map(
            (s) => html`
              <div
                class="skill-item ${this.selected?.id === s.id ? "active" : ""}"
                @click=${() => this.selectSkill(s)}
              >
                <div class="skill-name">${s.name}</div>
                ${s.description
                  ? html`<div class="skill-desc">${s.description}</div>`
                  : ""}
                <div class="skill-files">
                  ${s.files.map((f: string) => html`<span class="file-tag">${f}</span>`)}
                </div>
              </div>
            `
          )}
        </div>
        <div class="detail-panel ${!this.mobileShowDetail ? "hidden" : ""}">
          ${!this.selected
            ? html`<div class="empty">Select a skill to view</div>`
            : html`
                <div class="detail-header">
                  <div class="detail-header-left">
                    <button class="back-btn" @click=${this.goBackToList}>← Back</button>
                    <h2>${this.selected.name}</h2>
                    <div class="file-tabs">
                      ${this.selected.files.map(
                        (f: string) => html`
                          <button
                            class="file-tab ${f === this.activeFile ? "active" : ""}"
                            @click=${() => this.loadFile(this.selected.id, f)}
                          >${f}</button>
                        `
                      )}
                    </div>
                  </div>
                  <div class="detail-actions">
                    ${this.editing
                      ? html`
                          <button class="btn btn-cancel" @click=${this.cancelEdit}>Cancel</button>
                          <button class="btn btn-save" @click=${this.saveEdit} ?disabled=${this.saving}>
                            ${this.saving ? "Saving..." : "Save"}
                          </button>
                        `
                      : html`
                          <button class="btn btn-edit" @click=${this.startEdit}>Edit</button>
                          <button class="btn btn-danger" @click=${this.deleteSkill}>Delete</button>
                        `}
                  </div>
                </div>
                <div class="detail-body">
                  ${this.editing
                    ? html`<textarea
                        class="editor-area"
                        .value=${this.editContent}
                        @input=${(e: any) => (this.editContent = e.target.value)}
                      ></textarea>`
                    : this.renderFileContent()}
                </div>
              `}
        </div>
      </div>
    `;
  }
}
