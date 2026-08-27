import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const ROOT = path.resolve(import.meta.dirname, "..");
const DEFAULT_OUTPUT = path.join(ROOT, "exports", "Demand_Review_Dashboard_Standalone.html");

function readArg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function escapeInlineJson(value) {
  return value
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeInlineScript(value) {
  return value.replaceAll("</script", "<\\/script");
}

const output = path.resolve(ROOT, readArg("--output", DEFAULT_OUTPUT));
const title = readArg("--title", "TH CPG Demand Review Dashboard");
const dataPath = path.join(ROOT, "public", "data", "promo-dashboard-data.json");
const cssPath = path.join(ROOT, "app", "globals.css");

const [dashboardJson, css] = await Promise.all([
  fs.readFile(dataPath, "utf8"),
  fs.readFile(cssPath, "utf8"),
]);

JSON.parse(dashboardJson);

const vitePackage = await fs.realpath(path.join(ROOT, "node_modules", "vite", "package.json"));
const viteRequire = createRequire(vitePackage);
const esbuildPath = viteRequire.resolve("esbuild");
const esbuild = await import(pathToFileURL(esbuildPath).href);

const entry = `
import React from "react";
import { createRoot } from "react-dom/client";
import DemandDashboard from "./app/demand-dashboard.jsx";

const embeddedData = document.getElementById("dashboard-data").textContent;
const nativeFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const url = typeof input === "string" ? input : input?.url;
  if (url && url.endsWith("/data/promo-dashboard-data.json")) {
    return Promise.resolve(new Response(embeddedData, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
  }
  return nativeFetch(input, init);
};

createRoot(document.getElementById("root")).render(React.createElement(DemandDashboard));
`;

const build = await esbuild.build({
  stdin: {
    contents: entry,
    resolveDir: ROOT,
    sourcefile: "standalone-entry.jsx",
    loader: "jsx",
  },
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  minify: true,
  define: {
    "process.env.NODE_ENV": '"production"',
  },
  loader: {
    ".js": "jsx",
    ".jsx": "jsx",
  },
});

const js = build.outputFiles.find((file) => file.path.endsWith(".js"))?.text
  ?? build.outputFiles[0]?.text;
if (!js) throw new Error("The standalone JavaScript bundle was not generated.");

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Archived standalone Tim Hortons CPG demand review dashboard.">
  <title>${title}</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script id="dashboard-data" type="application/json">${escapeInlineJson(dashboardJson)}</script>
  <script>${escapeInlineScript(js)}</script>
</body>
</html>
`;

await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, html, "utf8");

const stats = await fs.stat(output);
console.log(JSON.stringify({ output, bytes: stats.size }, null, 2));
