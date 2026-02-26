import { customElement } from "lit/decorators.js";
import { FileViewer } from "../components/file-viewer.js";

@customElement("knowledge-page")
export class KnowledgePage extends FileViewer {
  readonly pageTitle = "Knowledge Base";
  readonly groups = ["knowledge"];
  readonly groupLabels = {
    knowledge: "Knowledge",
  };
}
