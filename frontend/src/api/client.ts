const BASE = "";

async function request(path: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem("dashboard_token");
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (options.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // Status
  getStatus: () => request("/api/status"),

  // Sessions
  getSessions: (channel?: string) =>
    request(`/api/sessions${channel ? `?channel=${channel}` : ""}`),
  getSession: (key: string) => request(`/api/sessions/${key}`),
  updateSessionNote: (key: string, note: string) =>
    request(`/api/sessions/${key}`, {
      method: "PATCH",
      body: JSON.stringify({ note }),
    }),
  deleteSession: (key: string) =>
    request(`/api/sessions/${key}`, { method: "DELETE" }),

  // Cron
  getCronJobs: () => request("/api/cron/jobs"),
  createCronJob: (data: any) =>
    request("/api/cron/jobs", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteCronJob: (id: string) =>
    request(`/api/cron/jobs/${id}`, { method: "DELETE" }),
  updateCronJob: (id: string, data: any) =>
    request(`/api/cron/jobs/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  runCronJob: (id: string) =>
    request(`/api/cron/jobs/${id}/run`, { method: "POST" }),

  // Memory
  getMemoryFiles: () => request("/api/memory/files"),
  getMemoryFile: (path: string) =>
    request(`/api/memory/files/${encodeURIComponent(path)}`),
  updateMemoryFile: (path: string, content: string) =>
    request(`/api/memory/files/${encodeURIComponent(path)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  deleteMemoryFile: (path: string) =>
    request(`/api/memory/files/${encodeURIComponent(path)}`, { method: "DELETE" }),

  // Skills
  getSkills: () => request("/api/skills"),
  getSkillFile: (id: string, filename: string) =>
    request(`/api/skills/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`),
  updateSkillFile: (id: string, filename: string, content: string) =>
    request(`/api/skills/${encodeURIComponent(id)}/${encodeURIComponent(filename)}`, {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),
  deleteSkill: (id: string) =>
    request(`/api/skills/${encodeURIComponent(id)}`, { method: "DELETE" }),

  // Config
  getConfig: () => request("/api/config"),
  getConfigRaw: () => request("/api/config/raw"),
  updateConfig: (content: string) =>
    request("/api/config", { method: "PUT", body: JSON.stringify({ content }) }),

  // Logs
  getLogFiles: () => request("/api/logs"),
  getLogFile: (name: string, lines = 500) =>
    request(`/api/logs/${encodeURIComponent(name)}?lines=${lines}`),

  // Media
  getMediaFiles: () => request("/api/media"),
  mediaUrl: (name: string) => `/api/media/${encodeURIComponent(name)}`,
  deleteMediaFile: (name: string) =>
    request(`/api/media/${encodeURIComponent(name)}`, { method: "DELETE" }),
};
