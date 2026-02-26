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
  { label: "每分钟", value: "* * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天", value: "0 0 * * *" },
  { label: "每周一", value: "0 0 * * 1" },
  { label: "每月 1 号", value: "0 0 1 * *" },
  { label: "自定义", value: "custom" },
];

@customElement("cron-page")
export class CronPage extends LitElement {
  @state() private jobs: any[] = [];
  @state() private error = "";
  @state() private refreshing = false;
  @state() private formMode: string | null = null;
  @state() private formData: FormData = emptyForm();
  @state() private scheduleMode: "preset" | "custom" = "custom";
  @state() private selectedPreset = "0 0 * * *";
  @state() private customHour = "0";
  @state() private customMinute = "0";

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
      border-radius: var(--r-lg); overflow: hidden;
      box-shadow: var(--shadow-card);
    }
    table { width: 100%; border-collapse: collapse; }
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
      white-space: nowrap; color: var(--text-muted); font-size: 12px; margin-top: 3px;
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
      .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
      table { min-width: 700px; }
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
    this.scheduleMode = "preset";
    this.selectedPreset = "0 0 * * *";
    this.customHour = "0";
    this.customMinute = "0";
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
    // Try to detect preset
    const preset = CRON_PRESETS.find(p => p.value === expr);
    if (preset) {
      this.scheduleMode = preset.value === "custom" ? "custom" : "preset";
      this.selectedPreset = expr;
    } else {
      // Parse custom cron
      this.scheduleMode = "custom";
      const parts = expr.split(" ");
      if (parts.length >= 2) {
        this.customMinute = parts[0] === "*" ? "0" : parts[0];
        this.customHour = parts[1] === "*" ? "0" : parts[1];
      }
    }
  }

  private buildSchedule(): string {
    if (this.scheduleMode === "preset") {
      return this.selectedPreset;
    }
    // Custom: build cron from hour/minute inputs
    const h = this.customHour || "0";
    const m = this.customMinute || "0";
    return `${m} ${h} * * *`;
  }

  private parsePresetOnChange(value: string) {
    this.selectedPreset = value;
    this.formData.schedule = value;
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
            <label>Schedule</label>
            <div style="display:flex;gap:10px;margin-bottom:10px">
              ${CRON_PRESETS.map(
                p => html`
                  <button
                    class="btn btn-sm ${this.scheduleMode === "preset" && this.selectedPreset === p.value ? "btn-primary" : "btn-ghost"}"
                    @click=${() => {
                      this.scheduleMode = "preset";
                      this.parsePresetOnChange(p.value);
                    }}
                  >${p.label}</button>
                `
              )}
            </div>
            ${this.scheduleMode === "custom" ? html`
              <div class="form-row" style="align-items:center;margin-bottom:10px">
                <span style="font-size:13px;color:var(--text-secondary)">每天</span>
                <select
                  style="width:80px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--r-sm);padding:8px;color:var(--text-primary);font-size:13px"
                  .value=${this.customHour}
                  @change=${(e: any) => { this.customHour = e.target.value; this.formData.schedule = this.buildSchedule(); }}
                >
                  ${Array.from({ length: 24 }, (_, i) => html`<option value=${i}>${String(i).padStart(2, "0")}</option>`)}
                </select>
                <span style="font-size:13px;color:var(--text-secondary)">时</span>
                <select
                  style="width:80px;background:var(--bg-input);border:1px solid var(--border-default);border-radius:var(--r-sm);padding:8px;color:var(--text-primary);font-size:13px"
                  .value=${this.customMinute}
                  @change=${(e: any) => { this.customMinute = e.target.value; this.formData.schedule = this.buildSchedule(); }}
                >
                  ${Array.from({ length: 60 }, (_, i) => html`<option value=${i}>${String(i).padStart(2, "0")}</option>`)}
                </select>
                <span style="font-size:13px;color:var(--text-secondary)">分</span>
              </div>
              <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">
                Cron: ${this.buildSchedule()}
              </div>
            ` : html`
              <div style="font-size:11px;color:var(--text-muted);font-family:var(--font-mono)">
                Cron: ${this.selectedPreset}
              </div>
            `}
          </div>

          <div class="form-group" style="margin-bottom:14px">
            <label>Message</label>
            <textarea .value=${this.formData.message}
              @input=${(e: any) => this.updateField("message", e.target.value)}
              placeholder="Task message..."></textarea>
          </div>
          ${isNew ? html`
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
          ` : ""}
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
                    <div class="job-schedule">${j.schedule?.expr}</div>
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
