import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.dirname(scriptDirectory);
const appRoot = path.join(projectRoot, "app");
const port = Number.parseInt(process.env.UKETUNE_PORT ?? "4173", 10);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webmanifest", "application/manifest+json; charset=utf-8"]
]);

function resolveRequestPath(requestUrl) {
  let decodedPath;
  try {
    const url = new URL(requestUrl, "http://localhost");
    decodedPath = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }
  const relativePath = decodedPath === "/"
    ? "index.html"
    : decodedPath.replace(/^\/+/, "");
  const resolvedPath = path.resolve(appRoot, relativePath);
  const appRootPrefix = `${path.resolve(appRoot)}${path.sep}`;

  if (resolvedPath !== path.resolve(appRoot) && !resolvedPath.startsWith(appRootPrefix)) {
    return null;
  }

  return resolvedPath;
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end("Method Not Allowed");
    return;
  }

  const resolvedPath = resolveRequestPath(request.url ?? "/");
  if (!resolvedPath) {
    response.writeHead(400);
    response.end("Bad Request");
    return;
  }

  try {
    const fileStats = await stat(resolvedPath);
    if (!fileStats.isFile()) {
      throw new Error("Not a file");
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Length": fileStats.size,
      "Content-Type": mimeTypes.get(path.extname(resolvedPath)) ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(resolvedPath).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not Found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`UkeTune development server: http://localhost:${port}`);
});
