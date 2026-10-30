import { build } from "esbuild";
import { readFile, readdir, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const project = path.resolve(fileURLToPath(new URL("../", import.meta.url)));
const output = path.resolve(project, "dist/bridge");
if (
  path.dirname(output) !== path.join(project, "dist") ||
  path.basename(output) !== "bridge"
)
  throw Error("Unexpected bridge build directory");
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const result = await build({
  absWorkingDir: project,
  entryPoints: ["src/bridge/server.ts"],
  outfile: "dist/bridge/bridge/server.js",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  minify: true,
  metafile: true,
  // ws has optional native accelerators; its supported JS fallbacks are bundled.
  external: ["bufferutil", "utf-8-validate"],
  banner: {
    js: 'import { createRequire } from "node:module"; const require = createRequire(import.meta.url);',
  },
});
const packages = new Set(["three"]);
for (const input of Object.keys(result.metafile.inputs)) {
  const name = /(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(input)?.[1];
  if (name) packages.add(name);
}
const notices = [];
for (const name of [...packages].sort()) {
  const dir = path.join(project, "node_modules", name);
  const info = JSON.parse(
    await readFile(path.join(dir, "package.json"), "utf8"),
  );
  const licenses = (await readdir(dir)).filter((f) =>
    /^(?:licen[cs]e|copying)(?:\..*)?$/i.test(f),
  );
  if (!licenses.length)
    throw Error(`Missing bundled dependency license: ${name}`);
  notices.push(
    `${name} ${info.version}\n${"=".repeat(60)}\n` +
      (
        await Promise.all(
          licenses.map((f) => readFile(path.join(dir, f), "utf8")),
        )
      ).join("\n"),
  );
}
await writeFile(
  path.join(output, "THIRD_PARTY_LICENSES.txt"),
  notices.join("\n\n"),
);
console.log(
  `Bundled companion and ${packages.size} dependency license notices.`,
);
