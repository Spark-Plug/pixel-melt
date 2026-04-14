/**
 * Build script — bundles src/ into a single dist/pixel-melt.html
 * Zero dependencies, pure Node.js.
 *
 * Each module is wrapped in its own IIFE, with its exports assigned to
 * a shared object _M so later modules can import from it.
 *
 * Usage: node src/build.js
 */

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname);
const DIST = path.join(__dirname, '..', 'dist');

// Read source files
const html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(SRC, 'style.css'), 'utf-8');
const retroCss = fs.readFileSync(path.join(SRC, 'theme-retro.css'), 'utf-8');

// JS modules in dependency order (settings → engine → controls → main)
const jsFiles = ['js/settings.js', 'js/engine.js', 'js/controls.js', 'js/main.js'];

function processModule(filePath) {
  const code = fs.readFileSync(path.join(SRC, filePath), 'utf-8');
  const moduleName = path.basename(filePath, '.js').replace(/[^a-zA-Z0-9_]/g, '_');

  // Collect all exported names
  const exports = [];
  code.replace(/^export\s+(?:async\s+)?(?:function|class|let|const|var)\s+(\w+)/gm, (_, name) => {
    exports.push(name);
  });
  // Also handle `export { a, b, c }` form
  code.replace(/^export\s*\{([^}]+)\}\s*;?\s*$/gm, (_, names) => {
    names.split(',').forEach(n => {
      const trimmed = n.trim().split(/\s+as\s+/)[0].trim();
      if (trimmed) exports.push(trimmed);
    });
  });

  // Strip import lines and 'export' keyword
  let body = code
    .replace(/^import\s+[^;]*;?\s*$/gm, '')                              // imports
    .replace(/^export\s+(async\s+)?(let|const|var|function|class)\s/gm, '$1$2 ')
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .trim();

  // Collect imports: map local name → _M.origName
  const importMap = {};
  code.replace(/^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"];?\s*$/gm, (_, names, from) => {
    names.split(',').forEach(n => {
      const parts = n.trim().split(/\s+as\s+/);
      const orig = parts[0].trim();
      const local = (parts[1] || parts[0]).trim();
      if (orig) importMap[local] = orig;
    });
  });

  // Rewrite identifier usages of imported names to `_M.origName` for live bindings.
  // This keeps ES module semantics (imports stay live even if the exporting module
  // reassigns a `let` variable later, e.g. currentImg = newImage).
  // Match word-boundary identifier, not preceded by `.` or `$` or word chars,
  // and not part of object key `X:` or property `.X` or declaration.
  for (const [local, orig] of Object.entries(importMap)) {
    const re = new RegExp(
      `(^|[^\\w$.])${local.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}(?=[^\\w$:]|$)`,
      'gm'
    );
    body = body.replace(re, (m, p1) => `${p1}_M.${orig}`);
  }

  // Generate exports: define getter on _M that reads current value
  const exportsBlock = exports.length
    ? '\n  ' + exports.map(n => `Object.defineProperty(_M, '${n}', { get: () => ${n}, configurable: true });`).join('\n  ')
    : '';

  return `// ── ${filePath} ──\n(() => {\n  ${body.replace(/\n/g, '\n  ')}${exportsBlock}\n})();`;
}

const mergedJS = '// Shared module registry\nconst _M = {};\n\n' + jsFiles.map(processModule).join('\n\n');

// Build the single-file HTML
let output = html.replace(
  /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/,
  `<style>\n${css}\n</style>`
);

output = output.replace(
  /<link\s+rel="stylesheet"\s+href="theme-retro\.css"\s*\/?>/,
  `<style>\n${retroCss}\n</style>`
);

output = output.replace(
  /<script\s+type="module"\s+src="js\/main\.js"\s*><\/script>/,
  `<script>\n${mergedJS}\n</script>`
);

// Ensure dist/ exists
if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });

const outPath = path.join(DIST, 'pixel-melt.html');
fs.writeFileSync(outPath, output, 'utf-8');

const size = (fs.statSync(outPath).size / 1024).toFixed(1);
console.log(`✓ Built ${outPath} (${size} KB)`);
