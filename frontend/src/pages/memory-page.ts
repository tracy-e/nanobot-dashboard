import { customElement } from "lit/decorators.js";
import { FileViewer } from "../components/file-viewer.js";

@customElement("memory-page")
export class MemoryPage extends FileViewer {
  readonly pageTitle = "Workspace Files";
  readonly groups = ["workspace", "memory", "heartbeat"];
  readonly groupLabels = {
    workspace: "Workspace",
    memory: "Memory",
    heartbeat: "Heartbeat",
  };
}
