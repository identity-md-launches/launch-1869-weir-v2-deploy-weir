import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../dist/", import.meta.url));
const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};
export async function serve(port = 0) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (!path.startsWith("/preview/")) {
        res.writeHead(404);
        res.end();
        return;
      }
      const file = resolve(
        root,
        path.slice("/preview/".length) || "index.html",
      );
      if (!file.startsWith(root) || !(await stat(file)).isFile()) {
        res.writeHead(404);
        res.end();
        return;
      }
      res.setHeader(
        "Content-Type",
        mime[extname(file)] ?? "application/octet-stream",
      );
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end();
    }
  });
  await new Promise((r) => server.listen(port, "0.0.0.0", r));
  return { server, url: `http://127.0.0.1:${server.address().port}/preview/` };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { server, url } = await serve(4173);
  console.log(url);
  const close = () => server.close(() => process.exit());
  process.on("SIGTERM", close);
  process.on("SIGINT", close);
  setTimeout(close, 15 * 60 * 1000);
}
