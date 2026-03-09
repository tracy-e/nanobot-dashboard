import { customElement } from "lit/decorators.js";
import { FileViewer } from "../components/file-viewer.js";
import { t } from "../i18n.js";

@customElement("knowledge-page")
export class KnowledgePage extends FileViewer {
  get pageTitle() { return t("knowledge.title"); }
  readonly groups = ["knowledge"];
  protected showSortControls = true;
  get groupLabels() {
    return { knowledge: t("knowledge.group") };
  }
}
