const fs = require("node:fs");
const path = require("node:path");

function validInstallation(folder) {
  if (typeof folder !== "string" || !path.isAbsolute(folder)) return false;
  try {
    return (
      fs.statSync(path.join(folder, "Dwarf Fortress.exe")).isFile() &&
      fs.statSync(path.join(folder, "data", "vanilla")).isDirectory()
    );
  } catch {
    return false;
  }
}
function readConfig(file) {
  try {
    const value = JSON.parse(fs.readFileSync(file, "utf8"));
    return value && typeof value.dfPath === "string"
      ? { dfPath: value.dfPath }
      : {};
  } catch {
    return {};
  }
}
function saveConfig(file, dfPath) {
  if (!validInstallation(dfPath))
    throw Error(
      "Choose the folder containing Dwarf Fortress.exe and data/vanilla.",
    );
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + ".tmp", JSON.stringify({ dfPath }, null, 2));
  fs.renameSync(file + ".tmp", file);
}
function isViewerURL(url, origin) {
  try {
    return !!origin && new URL(url).origin === origin;
  } catch {
    return false;
  }
}
module.exports = { validInstallation, readConfig, saveConfig, isViewerURL };
