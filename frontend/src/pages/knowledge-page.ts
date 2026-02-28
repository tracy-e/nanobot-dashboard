import { customElement } from "lit/decorators.js";
import { FileViewer } from "../components/file-viewer.js";

@customElement("knowledge-page")
export class KnowledgePage extends FileViewer {
  readonly pageTitle = "知识库";
  readonly groups = ["knowledge"];
  readonly groupLabels = {
    knowledge: "知识库",
  };
}
