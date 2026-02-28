import { customElement } from "lit/decorators.js";
import { FileViewer } from "../components/file-viewer.js";
import { api } from "../api/client.js";

@customElement("memory-page")
export class MemoryPage extends FileViewer {
  readonly pageTitle = "工作区";
  groups: string[] = [];
  groupLabels: Record<string, string> = {};

  async load() {
    try {
      const res = await api.getMemoryFiles();
      // Exclude knowledge (it has its own dedicated page)
      this.files = (res.files || []).filter((f: any) => f.group !== "knowledge");

      // Derive groups dynamically from data, "workspace" first
      const seen = new Set<string>();
      for (const f of this.files) seen.add(f.group);
      this.groups = ["workspace", ...[...seen].filter(g => g !== "workspace").sort()];
      this.groupLabels = Object.fromEntries(
        this.groups.map(g => [g, g.charAt(0).toUpperCase() + g.slice(1)])
      );
    } catch (e: any) {
      this.error = e.message;
    }
  }
}
