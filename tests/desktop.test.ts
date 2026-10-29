import { it, expect } from "vitest";
import { createRequire } from "node:module";
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
const { validInstallation, readConfig, saveConfig, isViewerURL } =
  createRequire(import.meta.url)("../desktop/config.cjs") as {
    validInstallation: (folder: unknown) => boolean;
    readConfig: (file: string) => { dfPath?: string };
    saveConfig: (file: string, dfPath: string) => void;
    isViewerURL: (url: string, origin: string) => boolean;
  };
it("accepts a real DF folder layout and saves only the chosen path outside it", () => {
  const root = mkdtempSync(path.join(tmpdir(), "deepwatch-config-"));
  try {
    const game = path.join(root, "game"),
      file = path.join(root, "app", "settings.json");
    mkdirSync(path.join(game, "data", "vanilla"), { recursive: true });
    writeFileSync(path.join(game, "Dwarf Fortress.exe"), "game-marker");
    expect(validInstallation(game)).toBe(true);
    expect(validInstallation("relative/game")).toBe(false);
    expect(validInstallation(undefined)).toBe(false);
    expect(() => saveConfig(file, root)).toThrow(/Dwarf Fortress/);
    saveConfig(file, game);
    expect(readConfig(file)).toEqual({ dfPath: game });
    expect(readFileSync(path.join(game, "Dwarf Fortress.exe"), "utf8")).toBe(
      "game-marker",
    );
    writeFileSync(file, "not json");
    expect(readConfig(file)).toEqual({});
  } finally {
    expect(path.dirname(root)).toBe(path.resolve(tmpdir()));
    rmSync(root, { recursive: true, force: true });
  }
});
it("restricts desktop navigation to the exact private companion origin", () => {
  const origin = "http://127.0.0.1:41231";
  expect(isViewerURL(origin + "/index.html", origin)).toBe(true);
  for (const url of [
    "https://example.com",
    "http://127.0.0.1:41232/",
    "http://127.0.0.1.evil.test:41231/",
    "file:///C:/Windows/notepad.exe",
    "javascript:alert(1)",
  ])
    expect(isViewerURL(url, origin)).toBe(false);
});
