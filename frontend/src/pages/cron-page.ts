import { LitElement, html, css } from "lit";
import { customElement, state } from "lit/decorators.js";
import { api } from "../api/client.js";

interface FormData {
  name: string;
  schedule: string;
  message: string;
  deliver: boolean;
  channel: string;
  to: string;
}

const emptyForm = (): FormData => ({
  name: "", schedule: "", message: "", deliver: false, channel: "", to: "",
});

// Cron frequency presets
const CRON_PRESETS = [
  { label: "Every minute", value: "minutely" },
  { label: "Hourly", value: "hourly" },
  { label: "Daily", value: "daily" },
  { label: "Weekly", value: "weekly" },
  { label: "Monthly", value: "monthly" },
  { label: "Custom", value: "custom" },
];

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

@customElement("cron-page")
export class CronPage extends LitElement {
  @state() private jobs: any[] = [];
  @state() private error = "";
  @state() private refreshing = false;
  @state() private formMode: string | null = null;
  @state() private formData: FormData = emptyForm();
  @state() private selectedPreset = "daily";
  @state() private customHour = "9";
  @state() private customMinute = "0";
  @state() private selectedWeekdays: number[] = [1];
  @state() private selectedMonthDay = "1";
  @state() private customCron = "";

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

    .toolbar {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 18px;
    }
    .toolbar-count { color: var(--text-muted); font-size: 13px; font-weight: 500; }

    /* Buttons */
    .btn {
      padding: 8px 18px; border-radius: var(--r-sm); font-size: 13px;
      cursor: pointer; border: 1px solid var(--border-default); font-weight: 500;
      font-family: var(--font-sans); transition: all 0.18s var(--ease);
      display: inline-flex; align-items: center; gap: 6px;
    }
    .btn-primary {
      background: var(--green); color: #fff; border-color: var(--green);
    }
    .btn-primary:hover {
      background: var(--green-dim);
      box-shadow: 0 0 16px rgba(74, 222, 128, 0.2);
    }
    .btn-danger { background: transparent; color: var(--red); border-color: var(--red-soft); }
    .btn-danger:hover { background: var(--red-soft); }
    .btn-sm { padding: 5px 12px; font-size: 11px; }
    .btn-ghost { background: transparent; color: var(--text-secondary); }
    .btn-ghost:hover { background: var(--bg-hover); color: var(--text-primary); }

    /* Table */
    .table-wrap {
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); overflow-x: auto; -webkit-overflow-scrolling: touch;
      box-shadow: var(--shadow-card);
    }
    table { width: 100%; border-collapse: collapse; min-width: 700px; }
    th {
      text-align: left; padding: 14px 18px; font-size: 11px;
      text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600;
      color: var(--text-muted); background: var(--bg-surface);
      border-bottom: 1px solid var(--border-subtle);
    }
    td {
      padding: 14px 18px; border-bottom: 1px solid var(--border-subtle);
      font-size: 13px; vertical-align: top;
    }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: var(--bg-elevated); }
    .job-name { color: var(--text-primary); font-weight: 600; }
    .job-schedule {
      color: var(--orange); font-family: var(--font-mono);
      font-size: 12px; font-weight: 500;
    }
    .enabled-badge {
      display: inline-block; padding: 3px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 600;
    }
    .enabled-badge.on { background: var(--green-soft); color: var(--green); }
    .enabled-badge.off { background: var(--red-soft); color: var(--red); }
    .status-text { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
    .actions { display: flex; gap: 6px; flex-wrap: wrap; }
    .msg-preview {
      max-width: 280px; overflow: hidden; text-overflow: ellipsis;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
      color: var(--text-muted); font-size: 12px; margin-top: 3px;
    }
    .time-info { font-size: 12px; color: var(--text-muted); font-family: var(--font-mono); }

    /* Modal */
    .modal-backdrop {
      position: fixed; inset: 0; background: rgba(0,0,0,0.6);
      z-index: 200; display: flex; align-items: center; justify-content: center;
    }
    .modal {
      background: var(--bg-card); border: 1px solid var(--border-subtle);
      border-radius: var(--r-lg); padding: 24px; width: 90vw; max-width: 520px;
      max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 48px rgba(0,0,0,0.4);
    }
    .modal-title {
      font-size: 14px; color: var(--text-primary); font-weight: 700;
      margin-bottom: 18px; letter-spacing: -0.3px;
    }

    /* Form */
    .form-row { display: flex; gap: 14px; margin-bottom: 14px; }
    .form-group { display: flex; flex-direction: column; gap: 5px; flex: 1; }
    .form-group label {
      font-size: 11px; color: var(--text-muted); text-transform: uppercase;
      letter-spacing: 0.5px; font-weight: 600;
    }
    .form-group input, .form-group textarea, .form-group select {
      background: var(--bg-input); border: 1px solid var(--border-default);
      border-radius: var(--r-sm); padding: 9px 14px; color: var(--text-primary);
      font-size: 13px; font-family: var(--font-sans);
      transition: border-color 0.15s var(--ease);
    }
    .form-group textarea { min-height: 80px; resize: vertical; }
    .form-group input:focus, .form-group textarea:focus, .form-group select:focus {
      outline: none; border-color: var(--green);
    }
    .form-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 18px; }

    .error { color: var(--red); margin-bottom: 12px; font-size: 13px; }

    @media (max-width: 768px) {
      h1 { font-size: 20px; }
      td, th { padding: 10px 12px; }
      .col-next { display: none; }
      .modal { width: 95vw; padding: 18px; }
      .form-row { flex-direction: column; }
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
      const res = await api.getCronJobs();
      this.jobs = res.jobs || [];
    } catch (e: any) {
      this.error = e.message;
    }
  }

  async toggleJob(job: any) {
    try {
      await api.updateCronJob(job.id, { enabled: !job.enabled });
      await this.load();
    } catch (e: any) { this.error = e.message; }
  }

  async deleteJob(job: any) {
    if (!confirm(`Delete job "${job.name}"?`)) return;
    try {
      await api.deleteCronJob(job.id);
      await this.load();
    } catch (e: any) { this.error = e.message; }
  }

  async runJob(job: any) {
    try {
      const res = await api.runCronJob(job.id);
      alert(res.note || `Triggered. Return code: ${res.returncode}`);
      await this.load();
    } catch (e: any) { this.error = e.message; }
  }

  openNew() {
    this.formMode = "new";
    this.formData = emptyForm();
    this.selectedPreset = "daily";
    this.customHour = "9";
    this.customMinute = "0";
    this.selectedWeekdays = [1];
    this.selectedMonthDay = "1";
    this.customCron = "";
  }

  openEdit(job: any) {
    this.formMode = job.id;
    const expr = job.schedule?.expr || "";
    this.formData = {
      name: job.name || "",
      schedule: expr,
      message: job.payload?.message || "",
      deliver: job.payload?.deliver || false,
      channel: job.payload?.channel || "",
      to: job.payload?.to || "",
    };
    // Parse cron to detect preset and time
    this.parseCronExpression(expr);
  }

  private parseCronExpression(expr: string) {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) {
      this.selectedPreset = "daily";
      this.customHour = "9";
      this.customMinute = "0";
      return;
    }
    const [m, h, dom, , dow] = parts;

    // Parse time
    this.customMinute = m === "*" ? "0" : m;
    this.customHour = h === "*" ? "0" : h;

    // Detect preset type
    if (expr.trim() === "* * * * *") {
      this.selectedPreset = "minutely";
    } else if (dom === "*" && dow === "*" && h === "*") {
      this.selectedPreset = "hourly";
    } else if (dom === "*" && dow === "*") {
      this.selectedPreset = "daily";
    } else if (dom === "*" && dow !== "*") {
      this.selectedPreset = "weekly";
      this.selectedWeekdays = dow.split(",").map(d => parseInt(d)).filter(d => !isNaN(d));
      if (this.selectedWeekdays.length === 0) this.selectedWeekdays = [1];
    } else if (dom !== "*" && dow === "*") {
      this.selectedPreset = "monthly";
      this.selectedMonthDay = dom;
    } else {
      // Complex expression — use custom mode to preserve it
      this.selectedPreset = "custom";
      this.customCron = expr;
    }
  }

  private buildSchedule(): string {
    const h = this.customHour || "0";
    const m = this.customMinute || "0";
    switch (this.selectedPreset) {
      case "minutely": return "* * * * *";
      case "hourly": return "0 * * * *";
      case "daily": return `${m} ${h} * * *`;
      case "weekly": {
        const days = this.selectedWeekdays.length > 0
          ? [...this.selectedWeekdays].sort((a, b) => a - b).join(",")
          : "1";
        return `${m} ${h} * * ${days}`;
      }
      case "monthly":
        return `${m} ${h} ${this.selectedMonthDay} * *`;
      case "custom":
        return this.customCron || "0 9 * * *";
      default:
        return "0 9 * * *";
    }
  }

  private toggleWeekday(day: number) {
    if (this.selectedWeekdays.includes(day)) {
      // Don't allow deselecting the last day
      if (this.selectedWeekdays.length > 1) {
        this.selectedWeekdays = this.selectedWeekdays.filter(d => d !== day);
      }
    } else {
      this.selectedWeekdays = [...this.selectedWeekdays, day];
    }
  }

  private describeCron(expr: string): string {
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) return expr;
    const [m, h, dom, , dow] = parts;

    if (expr.trim() === "* * * * *") return "Every minute";
    if (h === "*" && dom === "*" && dow === "*") {
      return m === "0" ? "Hourly" : `Hourly at :${m.padStart(2, "0")}`;
    }

    const time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    if (dom === "*" && dow === "*") return `Daily at ${time}`;
    if (dom === "*" && dow !== "*") {
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const days = dow.split(",").map(d => dayNames[parseInt(d)] || d).join(", ");
      return `${days} at ${time}`;
    }
    if (dom !== "*" && dow === "*") {
      const n = parseInt(dom);
      const s = (n > 3 && n < 21) ? "th" : ["th","st","nd","rd"][n % 10] || "th";
      return `Monthly ${n}${s} at ${time}`;
    }
    return expr;
  }

  closeForm() {
    this.formMode = null;
    this.formData = emptyForm();
  }

  async submitForm() {
    const d = this.formData;
    const schedule = this.buildSchedule();
    if (!d.name || !schedule || !d.message) {
      this.error = "Name, schedule, and message are required";
      return;
    }
    try {
      if (this.formMode === "new") {
        await api.createCronJob({
          name: d.name, schedule, message: d.message,
          deliver: d.deliver, channel: d.channel || null, to: d.to || null,
        });
      } else {
        await api.updateCronJob(this.formMode!, {
          name: d.name, schedule, message: d.message,
          channel: d.channel || null, to: d.to || null,
        });
      }
      this.closeForm();
      await this.load();
    } catch (e: any) { this.error = e.message; }
  }

  private fmtTime(ms: number | null) {
    if (!ms) return "—";
    return new Date(ms).toLocaleString("zh-CN");
  }

  private updateField(field: keyof FormData, value: string) {
    this.formData = { ...this.formData, [field]: value };
  }

  private renderModal() {
    const isNew = this.formMode === "new";
    return html`
      <div class="modal-backdrop" @click=${this.closeForm}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-title">${isNew ? "New Job" : "Edit Job"}</div>
          <div class="form-row">
            <div class="form-group">
              <label>Name</label>
              <input .value=${this.formData.name}
                @input=${(e: any) => this.updateField("name", e.target.value)}
                placeholder="my-task" />
            </div>
          </div>

          <!-- Schedule -->
          <div class="form-group" style="margin-bottom:14px">
            <label>Frequency</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
              ${CRON_PRESETS.map(
                p => html`
                  <button
                    class="btn btn-sm ${this.selectedPreset === p.value ? "btn-primary" : "btn-ghost"}"
                    @click=${() => { this.selectedPreset = p.value; }}
                  >${p.label}</button>
                `
              )}
            </div>
            ${this.selectedPreset === "weekly" ? html`
              <div style="margin-bottom:10px">
                <div style="font-size:11px;color:var(--text-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.5px;font-weight:600">Repeat on</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${WEEKDAYS.map(d => html`
                    <button
                      class="btn btn-sm ${this.selectedWeekdays.includes(d.value) ? "btn-primary" : "btn-ghost"}"
                      style="min-width:44px"
                      @click=${() => this.toggleWeekday(d.value)}
                    >${d.label}</button>
                  `)}
                </div>
              </div>
            ` : ""}
            ${this.selectedPreset === "monthly" ? html`
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <span style="font-size:13px;color:var(--text-secondary)">On day</span>
                <select
                  style="width:70px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--r-sm);padding:8px;color:var(--text-primary);font-size:13px"
                  @change=${(e: any) => { this.selectedMonthDay = e.target.value; }}
                >
                  ${Array.from({ length: 31 }, (_, i) => html`<option value=${i + 1} ?selected=${String(i + 1) === this.selectedMonthDay}>${i + 1}</option>`)}
                </select>
              </div>
            ` : ""}
            ${["daily", "weekly", "monthly"].includes(this.selectedPreset) ? html`
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
                <span style="font-size:13px;color:var(--text-secondary)">At</span>
                <select
                  style="width:70px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--r-sm);padding:8px;color:var(--text-primary);font-size:13px"
                  @change=${(e: any) => { this.customHour = e.target.value; }}
                >
                  ${Array.from({ length: 24 }, (_, i) => html`<option value=${i} ?selected=${String(i) === this.customHour}>${String(i).padStart(2, "0")}</option>`)}
                </select>
                <span style="font-size:13px;color:var(--text-secondary)">:</span>
                <select
                  style="width:70px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--r-sm);padding:8px;color:var(--text-primary);font-size:13px"
                  @change=${(e: any) => { this.customMinute = e.target.value; }}
                >
                  ${Array.from({ length: 60 }, (_, i) => html`<option value=${i} ?selected=${String(i) === this.customMinute}>${String(i).padStart(2, "0")}</option>`)}
                </select>
              </div>
            ` : ""}
            ${this.selectedPreset === "custom" ? html`
              <div style="margin-bottom:10px">
                <input
                  style="width:100%;box-sizing:border-box;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--r-sm);padding:9px 14px;color:var(--text-primary);font-size:13px;font-family:var(--font-mono)"
                  .value=${this.customCron}
                  @input=${(e: any) => { this.customCron = e.target.value; }}
                  placeholder="0 9 * * 1-5"
                />
              </div>
            ` : ""}
            <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">
              Cron: ${this.buildSchedule()}
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px">
            <label>Message</label>
            <textarea .value=${this.formData.message}
              @input=${(e: any) => this.updateField("message", e.target.value)}
              placeholder="Task message..."></textarea>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label>Channel</label>
              <input .value=${this.formData.channel}
                @input=${(e: any) => this.updateField("channel", e.target.value)}
                placeholder="discord" />
            </div>
            <div class="form-group">
              <label>To</label>
              <input .value=${this.formData.to}
                @input=${(e: any) => this.updateField("to", e.target.value)}
                placeholder="channel ID" />
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-ghost btn-sm" @click=${this.closeForm}>Cancel</button>
            <button class="btn btn-primary btn-sm" @click=${this.submitForm}>
              ${isNew ? "Create" : "Save"}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="page-header">
        <h1>Cron Jobs</h1>
        <button class="refresh-btn ${this.refreshing ? "spinning" : ""}" @click=${this.refresh} title="Refresh">&#x21bb;</button>
      </div>
      ${this.error ? html`<div class="error">${this.error}</div>` : ""}

      <div class="toolbar">
        <span class="toolbar-count">${this.jobs.length} jobs</span>
        ${this.formMode === null
          ? html`<button class="btn btn-primary" @click=${this.openNew}>+ New Job</button>`
          : ""}
      </div>

      ${this.formMode !== null ? this.renderModal() : ""}

      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Schedule</th>
              <th>Status</th>
              <th>Last Run</th>
              <th class="col-next">Next Run</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${this.jobs.map(
              (j) => html`
                <tr>
                  <td>
                    <div class="job-name">${j.name}</div>
                    <div class="msg-preview">${j.payload?.message}</div>
                  </td>
                  <td>
                    <div style="font-size:13px;color:var(--text-primary);font-weight:500">${this.describeCron(j.schedule?.expr || "")}</div>
                    <div class="job-schedule" style="margin-top:2px">${j.schedule?.expr}</div>
                    ${j.schedule?.tz ? html`<div class="time-info" style="margin-top:2px">${j.schedule.tz}</div>` : ""}
                  </td>
                  <td>
                    <span class="enabled-badge ${j.enabled ? "on" : "off"}">
                      ${j.enabled ? "Enabled" : "Disabled"}
                    </span>
                    ${j.state?.lastStatus ? html`<div class="status-text">${j.state.lastStatus}</div>` : ""}
                  </td>
                  <td class="time-info">${this.fmtTime(j.state?.lastRunAtMs)}</td>
                  <td class="time-info col-next">${this.fmtTime(j.state?.nextRunAtMs)}</td>
                  <td>
                    <div class="actions">
                      <button class="btn btn-sm btn-ghost" @click=${() => this.openEdit(j)}>Edit</button>
                      <button class="btn btn-sm btn-ghost" @click=${() => this.toggleJob(j)}>
                        ${j.enabled ? "Disable" : "Enable"}
                      </button>
                      <button class="btn btn-sm btn-ghost" @click=${() => this.runJob(j)}>Run</button>
                      <button class="btn btn-sm btn-danger" @click=${() => this.deleteJob(j)}>Delete</button>
                    </div>
                  </td>
                </tr>
              `
            )}
          </tbody>
        </table>
      </div>
    `;
  }
}
