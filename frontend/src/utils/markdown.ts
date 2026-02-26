import { Marked } from "marked";
import hljs from "highlight.js/lib/core";

// Register only common languages to keep bundle small
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import bash from "highlight.js/lib/languages/bash";
import typescript from "highlight.js/lib/languages/typescript";
import yaml from "highlight.js/lib/languages/yaml";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";

hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("md", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("ts", typescript);
hljs.registerLanguage("javascript", typescript); // close enough
hljs.registerLanguage("js", typescript);
hljs.registerLanguage("yaml", yaml);
hljs.registerLanguage("yml", yaml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);

const marked = new Marked({
  renderer: {
    code({ text, lang }: { text: string; lang?: string }) {
      const language = lang && hljs.getLanguage(lang) ? lang : undefined;
      const highlighted = language
        ? hljs.highlight(text, { language }).value
        : hljs.highlightAuto(text).value;
      return `<pre><code class="hljs${language ? ` language-${language}` : ""}">${highlighted}</code></pre>`;
    },
  },
});

export function renderMarkdown(src: string): string {
  return marked.parse(src) as string;
}

/**
 * Highlight a full file as a given language (for JSON, etc.)
 */
export function highlightFile(src: string, lang: string): string {
  const language = hljs.getLanguage(lang) ? lang : undefined;
  if (language) {
    return `<pre><code class="hljs language-${language}">${hljs.highlight(src, { language }).value}</code></pre>`;
  }
  return `<pre><code class="hljs">${hljs.highlightAuto(src).value}</code></pre>`;
}
