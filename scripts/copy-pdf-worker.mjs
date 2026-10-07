// Copies the pdf.js worker into /public so the PDF reader can load it
// from the same origin (no CDN dependency, CSP-friendly).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
try {
  const pkg = require.resolve("pdfjs-dist/package.json", {
    paths: [require.resolve("react-pdf")],
  });
  const src = join(dirname(pkg), "build", "pdf.worker.min.mjs");
  if (!existsSync(src)) throw new Error(`worker not found at ${src}`);
  mkdirSync("public", { recursive: true });
  copyFileSync(src, join("public", "pdf.worker.min.mjs"));
  console.log("[sanady] pdf.js worker copied to public/");
} catch (err) {
  console.warn("[sanady] could not copy pdf.js worker:", err.message);
}
