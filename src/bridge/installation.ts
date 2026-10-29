import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
export function tokens(text: string): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const match of text.matchAll(/\[([A-Z_]+):([^\]\r\n]*)\]/g)) {
    const values = result.get(match[1]) ?? [];
    values.push(match[2]);
    result.set(match[1], values);
  }
  return result;
}
export interface ModMetadata {
  directory: string;
  id: string;
  version: string;
  name: string;
}
export async function inspectInstallation(installation: string) {
  const root = path.resolve(installation);
  if (!(await stat(path.join(root, "Dwarf Fortress.exe"))).isFile())
    throw Error("DF_PATH does not contain Dwarf Fortress.exe");
  const modules: ModMetadata[] = [];
  for (const relative of ["data/vanilla", "data/installed_mods", "mods"]) {
    let entries;
    try {
      entries = await readdir(path.join(root, relative), {
        withFileTypes: true,
      });
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw e;
    }
    for (const dir of entries) {
      if (!dir.isDirectory() || dir.isSymbolicLink()) continue;
      try {
        const data = tokens(
          await readFile(
            path.join(root, relative, dir.name, "info.txt"),
            "utf8",
          ),
        );
        if (data.has("ID"))
          modules.push({
            directory: relative + "/" + dir.name,
            id: data.get("ID")![0],
            version: data.get("NUMERIC_VERSION")?.[0] ?? "",
            name: data.get("NAME")?.[0] ?? dir.name,
          });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
      }
    }
  }
  let remotePort = 5000;
  try {
    const config: unknown = JSON.parse(
      await readFile(
        path.join(root, "dfhack-config/remote-server.json"),
        "utf8",
      ),
    );
    if (
      typeof config === "object" &&
      config !== null &&
      "port" in config &&
      Number.isInteger(config.port) &&
      Number(config.port) > 0 &&
      Number(config.port) <= 65535
    )
      remotePort = Number(config.port);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  return { root, remotePort, modules };
}
