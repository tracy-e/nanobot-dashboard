import darkTheme from "highlight.js/styles/github-dark.css?inline";
import lightTheme from "highlight.js/styles/github.css?inline";

export const hljsThemeCSS = `
  @media (prefers-color-scheme: dark) { ${darkTheme} }
  @media (prefers-color-scheme: light) { ${lightTheme} }
`;
