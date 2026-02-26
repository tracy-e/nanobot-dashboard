import { LitElement, html, css, svg } from "lit";
import { customElement, property } from "lit/decorators.js";

@customElement("nav-sidebar")
export class NavSidebar extends LitElement {
  @property() active = "status";
  @property({ type: Array }) hiddenItems: string[] = [];

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 240px;
      min-height: 100vh;
      background: var(--bg-surface);
      border-right: 1px solid var(--border-subtle);
      padding: 0;
      flex-shrink: 0;
    }

    /* ---- Brand ---- */
    .brand {
      padding: 28px 24px 32px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .brand-mark {
      width: 36px; height: 36px; border-radius: var(--r-md);
      background: linear-gradient(135deg, var(--green) 0%, var(--green-dim) 100%);
      display: flex; align-items: center; justify-content: center;
      font-size: 17px; color: #fff; font-weight: 800;
      font-family: var(--font-sans);
      box-shadow: 0 2px 12px rgba(74, 222, 128, 0.25);
      flex-shrink: 0;
    }
    .brand-name {
      font-size: 18px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.5px;
    }
    .brand-name span {
      color: var(--text-muted);
      font-weight: 400;
      font-size: 12px;
      margin-left: 5px;
      letter-spacing: 0;
    }

    /* ---- Nav ---- */
    nav {
      padding: 0 14px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      flex: 1;
    }

    a {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 14px;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 13.5px;
      font-weight: 500;
      border-radius: var(--r-sm);
      transition: all 0.18s var(--ease);
      position: relative;
    }
    a:hover {
      color: var(--text-primary);
      background: var(--bg-hover);
    }
    a.active {
      color: var(--green);
      background: var(--green-soft);
    }
    a.active::before {
      content: '';
      position: absolute;
      left: 0; top: 10px; bottom: 10px;
      width: 3px;
      border-radius: 0 4px 4px 0;
      background: var(--green);
    }

    .nav-icon {
      width: 20px; height: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0.55;
      transition: opacity 0.18s;
      flex-shrink: 0;
    }
    .nav-icon svg {
      width: 18px; height: 18px;
      stroke: currentColor; fill: none;
      stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round;
    }
    a:hover .nav-icon { opacity: 0.85; }
    a.active .nav-icon { opacity: 1; }

    /* ---- Footer ---- */
    .footer {
      padding: 16px 24px;
      margin-top: auto;
      border-top: 1px solid var(--border-subtle);
      font-size: 11px;
      color: var(--text-muted);
      letter-spacing: 0.2px;
    }
  `;

  // SVG icon templates (18x18 viewBox, stroke-based)
  private icons: Record<string, ReturnType<typeof svg>> = {
    // Status — pulse/activity monitor
    status: svg`<path d="M2 10h3l2-5 3 10 2-5h4"/>
                <circle cx="15" cy="10" r="1.5" fill="currentColor" stroke="none"/>`,
    // Sessions — chat bubbles
    sessions: svg`<path d="M3 4h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H7l-3 2.5V11H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>
                  <path d="M14 8h1a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-1v2.5L11 15H7a1 1 0 0 1-1-1v-1" opacity="0.5"/>`,
    // Cron — clock with hands
    cron: svg`<circle cx="9" cy="9" r="7"/>
              <path d="M9 5v4l2.5 2.5"/>`,
    // Memory — chip/brain
    memory: svg`<rect x="4" y="4" width="10" height="10" rx="1.5"/>
                <path d="M7 4V2m4 2V2M7 14v2m4-2v2M4 7H2m2 4H2m14-4h-2m2 4h-2"/>
                <circle cx="9" cy="9" r="1.5"/>`,
    // Knowledge — open book
    knowledge: svg`<path d="M2 4c2-1 4-1 7 0v12c-3-1-5-1-7 0z"/>
                   <path d="M16 4c-2-1-4-1-7 0v12c3-1 5-1 7 0z"/>`,
    // Skills — lightning bolt
    skills: svg`<path d="M10 2L4 10h4.5l-1 6L14 8H9.5z" fill="currentColor" stroke="none" opacity="0.85"/>`,
    // Logs — terminal/document lines
    logs: svg`<rect x="2" y="2" width="14" height="14" rx="2"/>
              <path d="M5 6h8M5 9h6M5 12h4"/>`,
  };

  private items = [
    { id: "status", label: "Status" },
    { id: "sessions", label: "Sessions" },
    { id: "cron", label: "Cron Jobs" },
    { id: "memory", label: "Memory" },
    { id: "knowledge", label: "Knowledge" },
    { id: "skills", label: "Skills" },
    { id: "logs", label: "Logs" },
  ];

  render() {
    return html`
      <div class="brand">
        <div class="brand-mark">N</div>
        <div class="brand-name">nanobot<span>dash</span></div>
      </div>
      <nav>
        ${this.items.filter((item) => !this.hiddenItems.includes(item.id)).map(
          (item) => html`
            <a
              href="#${item.id}"
              class=${item.id === this.active ? "active" : ""}
              @click=${(e: Event) => {
                e.preventDefault();
                this.dispatchEvent(
                  new CustomEvent("navigate", { detail: item.id })
                );
              }}
            >
              <span class="nav-icon"><svg viewBox="0 0 18 18">${this.icons[item.id]}</svg></span>
              ${item.label}
            </a>
          `
        )}
      </nav>
      <div class="footer">nanobot v0.1</div>
    `;
  }
}
