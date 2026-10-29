// A CJS utility-process entry keeps startup independent of Electron's ESM loader.
const path = require("node:path");
const { pathToFileURL } = require("node:url");
import(
  pathToFileURL(path.join(__dirname, "../dist/bridge/bridge/server.js")).href
).catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
