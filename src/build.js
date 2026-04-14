/**
 * Build script — bundles src/ into a single dist/pixel-melt.html
 * Zero dependencies, pure Node.js.
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

// JS modules in dependency order (settings → engine → controls → main)
const jsFiles = ['js/settings.js', 'js/engine.js', 'js/controls.js', 'js/main.js'];
const jsContents = jsFiles.map(f => fs.readFileSync(path.join(SRC, f), 'utf-8'));

// Strip import/export statements and merge into a single IIFE
function stripModuleSyntax(code) {
  return code
    // Remove import lines
    .replace(/^import\s+.*?;?\s*$/gm, '')
    // Remove 'export ' keyword (keep the declaration)
    .replace(/^export\s+(async\s+)?(let|const|var|function|class)\s/gm, '$1$2 ')
    // Remove 'export { ... }' lines
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .trim();
}

const mergedJS = jsContents.map(stripModuleSyntax).join('\n\n');

// Build the single-file HTML
// Replace <link rel="stylesheet" ...> with inline <style>
let output = html.replace(
  /<link\s+rel="stylesheet"\s+href="style\.css"\s*\/?>/,
  `<style>\n${css}\n</style>`
);

// Replace <script type="module" src="..."> with inline <script>
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
