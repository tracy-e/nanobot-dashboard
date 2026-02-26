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

@customElement("nano-app")
export class NanoApp extends LitElement {
  @state() page = "status";
  @state() hasKnowledge = false;

  static styles = css`
    :host {
      display: flex;
      min-height: 100vh;
      background: var(--bg-root);
    }
    main {
      flex: 1;
      padding: 32px 40px;
      overflow-y: auto;
      max-height: 100vh;
      background:
        radial-gradient(ellipse at 70% 0%, rgba(74, 222, 128, 0.025) 0%, transparent 55%),
        radial-gradient(ellipse at 30% 100%, rgba(245, 158, 11, 0.015) 0%, transparent 55%),
        var(--bg-root);
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    const hash = location.hash.slice(1);
    if (hash) this.page = hash;
    window.addEventListener("hashchange", () => {
      this.page = location.hash.slice(1) || "status";
    });
    this.checkKnowledge();
  }

  private async checkKnowledge() {
    try {
      const res = await api.getMemoryFiles();
      this.hasKnowledge = (res.files || []).some((f: any) => f.group === "knowledge");
    } catch {}
  }

  private navigate(e: CustomEvent) {
    this.page = e.detail;
    location.hash = e.detail;
  }

  render() {
    return html`
      <nav-sidebar .active=${this.page} .hiddenItems=${this.hasKnowledge ? [] : ["knowledge"]} @navigate=${this.navigate}></nav-sidebar>
      <main>
        ${this.page === "status" ? html`<status-page></status-page>` : ""}
        ${this.page === "sessions" ? html`<sessions-page></sessions-page>` : ""}
        ${this.page === "cron" ? html`<cron-page></cron-page>` : ""}
        ${this.page === "memory" ? html`<memory-page></memory-page>` : ""}
        ${this.page === "knowledge" ? html`<knowledge-page></knowledge-page>` : ""}
        ${this.page === "skills" ? html`<skills-page></skills-page>` : ""}
        ${this.page === "logs" ? html`<logs-page></logs-page>` : ""}
      </main>
    `;
  }
}
