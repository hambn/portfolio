// Linguist colours for the languages the cards and the projects page draw.
// GitHub's own swatch colours, so a language reads the same as on github.com.
export const LANG_COLORS = {
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  Nix: '#7e7eff',
  Go: '#00ADD8',
  Shell: '#89e051',
  Rust: '#dea584',
  YAML: '#cb171e',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Dockerfile: '#384d54',
  Lua: '#000080',
  Ruby: '#701516',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Java: '#b07219',
  Kotlin: '#A97BFF',
  Swift: '#F05138',
  PHP: '#4F5D95',
  Dart: '#00B4AB',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Astro: '#ff5a03',
  HCL: '#844FBA',
  PowerShell: '#012456',
  'Jupyter Notebook': '#DA5B0B',
  Makefile: '#427819',
  Zig: '#ec915c',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
};

/** The language's swatch, or GitHub's grey for one it has no colour for. */
export const langColor = (name) => LANG_COLORS[name] || '#8b949e';
