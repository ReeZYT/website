/* Builds the live site into dist/: HTML, CSS and JS are minified and
   mangled, comments stripped. The source files in the repo stay readable.
   npm install && npm run build   ->   dist/  (preview: python3 -m http.server -d dist) */
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { minify as terser } from "terser";
import { minify as html } from "html-minifier-terser";
import CleanCSS from "clean-css";

const OUT = "dist";
const JS_OPTS = {
  ecma: 2020,
  toplevel: true,
  compress: { passes: 3, drop_console: false, pure_getters: true },
  mangle: { toplevel: true },
  format: { comments: false },
};
const CSS_OPTS = { level: 2 };
const HTML_OPTS = {
  collapseWhitespace: true,
  conservativeCollapse: false,
  removeComments: true,
  removeRedundantAttributes: true,
  removeScriptTypeAttributes: true,
  removeStyleLinkTypeAttributes: true,
  useShortDoctype: true,
  sortAttributes: true,
  sortClassName: true,
  minifyCSS: CSS_OPTS,
  minifyJS: JS_OPTS,
};

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(1) + " KB";
const log = (f, a, b) => console.log(`${f.padEnd(12)} ${kb(a).padStart(9)} -> ${kb(b)}`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);

for (const f of ["index.html", "404.html"]) {
  const src = readFileSync(f, "utf8");
  const out = await html(src, HTML_OPTS);
  writeFileSync(`${OUT}/${f}`, out); log(f, src, out);
}

{
  const src = readFileSync("styles.css", "utf8");
  const r = new CleanCSS(CSS_OPTS).minify(src);
  if (r.errors.length) throw new Error(r.errors.join("\n"));
  writeFileSync(`${OUT}/styles.css`, r.styles); log("styles.css", src, r.styles);
}

{
  const src = readFileSync("script.js", "utf8");
  const r = await terser(src, JS_OPTS);
  writeFileSync(`${OUT}/script.js`, r.code); log("script.js", src, r.code);
}

{
  const src = readFileSync("favicon.svg", "utf8");
  const out = await html(src, { collapseWhitespace: true, removeComments: true, keepClosingSlash: true, caseSensitive: true });
  writeFileSync(`${OUT}/favicon.svg`, out); log("favicon.svg", src, out);
}

for (const f of ["CNAME", ".nojekyll"]) if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
cpSync("assets", `${OUT}/assets`, { recursive: true, filter: (p) => !p.endsWith("README.md") && !p.endsWith(".DS_Store") });

console.log(`\nDone -> ${OUT}/`);
