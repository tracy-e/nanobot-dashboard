import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api } from "./api/client.js";
import "./components/nav-sidebar.js";
import "./pages/status-page.js";
import "./pages/sessions-page.js";
import "./pages/cron-page.js";
import "./pages/memory-page.js";
import "./pages/knowledge-page.js";
import "./pages/skills-page.js";
import "./pages/logs-page.js";
import "./pages/media-page.js";
import "./components/chat-widget.js";
import "./components/search-modal.js";

@customElement("nano-app")
export class NanoApp extends LitElement {
  @state() page = "status";
  @state() hasKnowledge = false;
  @state() hasMedia = false;
  @state() sidebarOpen = false;

  static styles = css`
    :host {
      display: flex;
      height: 100vh;
      overflow: hidden;
      background: var(--bg-root);
    }
    main {
      flex: 1;
      padding: 32px 40px;
      overflow-y: auto;
      min-height: 0;
      background:
        radial-gradient(ellipse at 70% 0%, rgba(74, 222, 128, 0.025) 0%, transparent 55%),
        radial-gradient(ellipse at 30% 100%, rgba(245, 158, 11, 0.015) 0%, transparent 55%),
        var(--bg-root);
    }
    .hamburger {
      display: none;
      position: fixed; top: 12px; left: 12px; z-index: 110;
      width: 40px; height: 40px; border-radius: var(--r-sm);
      background: var(--bg-card); border: 1px solid var(--border-default);
      color: var(--text-primary); font-size: 20px; cursor: pointer;
      align-items: center; justify-content: center;
      box-shadow: var(--shadow-card);
    }
    .sidebar-overlay {
      display: none; position: fixed; inset: 0;
      background: rgba(0,0,0,0.5); z-index: 99;
    }
    .sidebar-overlay.open { display: block; }
    @media (max-width: 768px) {
      main { padding: 56px 16px 16px; }
      .hamburger { display: flex; }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    const hash = location.hash.slice(1);
    if (hash) this.page = hash;
    window.addEventListener("hashchange", () => {
      this.page = location.hash.slice(1) || "status";
    });
    this.checkOptionalTabs();
  }

  private async checkOptionalTabs() {
    try {
      const res = await api.getMemoryFiles();
      this.hasKnowledge = (res.files || []).some((f: any) => f.group === "knowledge");
    } catch {}
    try {
      const res = await api.getMediaFiles();
      this.hasMedia = res.exists === true;
    } catch {}
  }

  private navigate(e: CustomEvent) {
    this.page = e.detail;
    location.hash = e.detail;
    this.sidebarOpen = false;
  }

  render() {
    return html`
      <button class="hamburger" @click=${() => this.sidebarOpen = !this.sidebarOpen}>☰</button>
      <div class="sidebar-overlay ${this.sidebarOpen ? "open" : ""}" @click=${() => this.sidebarOpen = false}></div>
      <nav-sidebar .active=${this.page} .hiddenItems=${[...this.hasKnowledge ? [] : ["knowledge"], ...this.hasMedia ? [] : ["media"]]} ?open=${this.sidebarOpen} @navigate=${this.navigate} @close=${() => this.sidebarOpen = false}></nav-sidebar>
      <main>
        ${this.page === "status" ? html`<status-page></status-page>` : ""}
        ${this.page === "sessions" ? html`<sessions-page></sessions-page>` : ""}
        ${this.page === "cron" ? html`<cron-page></cron-page>` : ""}
        ${this.page === "workspace" ? html`<memory-page></memory-page>` : ""}
        ${this.page === "knowledge" ? html`<knowledge-page></knowledge-page>` : ""}
        ${this.page === "skills" ? html`<skills-page></skills-page>` : ""}
        ${this.page === "media" ? html`<media-page></media-page>` : ""}
        ${this.page === "logs" ? html`<logs-page></logs-page>` : ""}
      </main>
      <chat-widget></chat-widget>
      <search-modal></search-modal>
    `;
  }
}
