import path from "node:path";
export function publicFile(root: string, pathname: string): string | undefined {
  // Only Vite's public entry point and flat, generated asset identifiers.
  // Game artwork is intentionally absent until active-mod resolution exists.
  if (pathname === "/" || pathname === "/index.html")
    return path.join(root, "index.html");
  if (!/^\/assets\/[a-zA-Z0-9_-]+\.(js|css|svg|png|woff2)$/.test(pathname))
    return undefined;
  return path.join(root, ...pathname.slice(1).split("/"));
}
