import { build } from "esbuild";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { chromium } from "playwright";
import { scenes } from "./diagram-scenes.mjs";

await mkdir("tmp/excalidraw", { recursive: true });
await mkdir("web/diagramas", { recursive: true });
await mkdir("web/assets/vendor", { recursive: true });
for (const file of ["leaflet.js", "leaflet.css", "images"]) await cp(`node_modules/leaflet/dist/${file}`, `web/assets/vendor/${file}`, { recursive: true });
await cp("node_modules/leaflet/LICENSE", "web/assets/vendor/LEAFLET-LICENSE.txt");
await build({
  stdin: { contents: 'import { convertToExcalidrawElements, exportToSvg } from "@excalidraw/excalidraw"; window.diagramTools={convertToExcalidrawElements,exportToSvg};', resolveDir: process.cwd() },
  bundle: true, outfile: "tmp/excalidraw/bundle.js", format: "iife", platform: "browser",
  define: { "process.env.NODE_ENV": '"production"' }, loader: { ".woff2": "file", ".woff": "file" }, logLevel: "warning"
});
const root = resolve(".");
const server = createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("Content-Type", "text/html");
      res.end('<!doctype html><meta charset="utf-8"><script>window.EXCALIDRAW_ASSET_PATH="/node_modules/@excalidraw/excalidraw/dist/prod/";</script><script src="/tmp/excalidraw/bundle.js"></script>');
      return;
    }
    const filename = decodeURIComponent(req.url.split("?")[0]);
    if (!(filename.startsWith("/tmp/excalidraw/") || filename.startsWith("/node_modules/@excalidraw/excalidraw/dist/prod/"))) { res.writeHead(404).end(); return; }
    const path = resolve(root, "." + filename);
    if (!path.startsWith(root + "/") && !path.startsWith(root + "\\")) { res.writeHead(403).end(); return; }
    const types = { ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".woff": "font/woff" };
    res.setHeader("Content-Type", types[extname(path)] || "application/octet-stream");
    res.end(await readFile(path));
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
let browser;
try {
  browser = await chromium.launch({ headless: true, ...((process.env.BROWSER_PATH || process.platform === "win32") ? { executablePath: process.env.BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" } : {}) });
  const page = await browser.newPage();
  page.setDefaultTimeout(180000); page.setDefaultNavigationTimeout(180000);
  page.on("pageerror", error => console.error(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.diagramTools);
  for (const scene of scenes) {
    const result = await page.evaluate(async skeleton => {
      const { convertToExcalidrawElements, exportToSvg } = window.diagramTools;
      const elements = convertToExcalidrawElements(skeleton, { regenerateIds: false });
      const appState = { viewBackgroundColor: "#ffffff", exportBackground: true, exportWithDarkMode: false, exportEmbedScene: true };
      const svg = await exportToSvg({ elements, appState, files: {}, exportPadding: 35 });
      return { elements, appState, svg: svg.outerHTML };
    }, scene.elements);
    const data = { type: "excalidraw", version: 2, source: "https://excalidraw.com", elements: result.elements, appState: result.appState, files: {} };
    await writeFile(`web/diagramas/${scene.slug}.excalidraw`, JSON.stringify(data, null, 2));
    await writeFile(`web/diagramas/${scene.slug}.svg`, result.svg);
    console.log(`Exportado con Excalidraw: ${scene.slug} (${result.elements.length} elementos)`);
  }
  await writeFile("web/diagramas/index.json", JSON.stringify(scenes.map(({ slug, name, caption }) => ({ slug, name, caption })), null, 2));
} finally { if (browser) await browser.close(); server.close(); }
