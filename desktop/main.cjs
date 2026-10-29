const {
  app,
  BrowserWindow,
  Menu,
  dialog,
  utilityProcess,
  shell,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const {
  validInstallation,
  readConfig,
  saveConfig,
  isViewerURL,
} = require("./config.cjs");

app.setName("Deepwatch");
app.setAppUserModelId("com.mbaldwinsmith.deepwatch");
const smoke = app.commandLine.hasSwitch("smoke-test");
if (smoke && process.env.CI) {
  app.commandLine.appendSwitch("use-angle", "swiftshader");
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
}
if (smoke && process.env.DEEPWATCH_SMOKE_USER_DATA) {
  fs.mkdirSync(path.resolve(process.env.DEEPWATCH_SMOKE_USER_DATA), {
    recursive: true,
  });
  app.setPath("userData", path.resolve(process.env.DEEPWATCH_SMOKE_USER_DATA));
}
let window,
  child,
  origin = "",
  quitting = false,
  restarting = false;
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    if (window) {
      if (window.isMinimized()) window.restore();
      window.show();
      window.focus();
    }
  });
  app.whenReady().then(start).catch(fail);
}
function log(text) {
  const dir = app.getPath("logs");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "companion.log");
  if (fs.existsSync(file) && fs.statSync(file).size > 2 * 1024 * 1024)
    fs.writeFileSync(file, "");
  fs.appendFileSync(file, String(text));
}
function fail(error) {
  log(`${error?.stack ?? error}\n`);
  if (smoke) {
    console.error(error);
    child?.kill();
    app.exit(1);
    return;
  }
  if (window && !window.isDestroyed()) window.show();
  dialog.showErrorBox(
    "Deepwatch could not start",
    `${error.message ?? error}\n\nUse File > Restart companion to retry. Logs: ${app.getPath("logs")}`,
  );
  if (!window || window.isDestroyed()) app.quit();
}
const configFile = () => path.join(app.getPath("userData"), "settings.json");
async function chooseFolder() {
  const result = await dialog.showOpenDialog(window, {
    title: "Choose your Dwarf Fortress folder (read-only)",
    properties: ["openDirectory"],
  });
  if (result.canceled) return false;
  if (!validInstallation(result.filePaths[0])) {
    dialog.showErrorBox(
      "Dwarf Fortress folder not found",
      "Choose the folder containing Dwarf Fortress.exe and data/vanilla. No game files will be changed.",
    );
    return false;
  }
  saveConfig(configFile(), result.filePaths[0]);
  return true;
}
async function stopCompanion() {
  const previous = child;
  child = undefined;
  if (!previous) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2000);
    previous.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    previous.kill();
  });
}
async function launchCompanion() {
  if (restarting) return;
  restarting = true;
  try {
    await stopCompanion();
    origin = "";
    await window.loadFile(path.join(__dirname, "loading.html"));
    const configured = readConfig(configFile()).dfPath;
    const dfPath = smoke
      ? undefined
      : [
          configured,
          process.env.DF_PATH,
          path.join(
            process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
            "Steam",
            "steamapps",
            "common",
            "Dwarf Fortress",
          ),
        ].find(validInstallation);
    const env = {
      ...process.env,
      VIEWER_DESKTOP: "1",
      VIEWER_PORT: "0",
      VIEWER_DIST: path.join(app.getAppPath(), "dist/viewer"),
      DOTENV_CONFIG_PATH: path.join(app.getPath("userData"), ".no-env"),
    };
    if (dfPath) env.DF_PATH = dfPath;
    else delete env.DF_PATH;
    // The selected installation supplies its configured RPC port. Explicit
    // development environment overrides remain available outside smoke tests.
    if (smoke) delete env.DFHACK_PORT;
    const current = utilityProcess.fork(
      path.join(__dirname, "companion.cjs"),
      [],
      {
        cwd: app.getPath("userData"),
        env,
        stdio: "pipe",
        serviceName: "Deepwatch read-only DFHack companion",
      },
    );
    child = current;
    current.stdout?.on("data", log);
    current.stderr?.on("data", log);
    const ready = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () =>
          reject(Error("The local companion did not start within 30 seconds.")),
        30000,
      );
      current.once("message", (message) => {
        if (
          message?.type !== "ready" ||
          !Number.isInteger(message.port) ||
          message.port < 1 ||
          message.port > 65535
        ) {
          clearTimeout(timeout);
          reject(Error("Invalid companion startup response"));
          return;
        }
        clearTimeout(timeout);
        resolve(message.port);
      });
      current.once("exit", (code) => {
        clearTimeout(timeout);
        reject(
          Error(
            `The companion exited during startup (${code}). Check its log.`,
          ),
        );
      });
    });
    current.on("exit", (code) => {
      if (child === current && !quitting) {
        origin = "";
        fail(Error(`The local companion stopped (${code}).`));
      }
    });
    origin = `http://127.0.0.1:${ready}`;
    await window.loadURL(origin);
    if (!smoke) window.show();
  } finally {
    restarting = false;
  }
}
async function start() {
  fs.mkdirSync(app.getPath("userData"), { recursive: true });
  window = new BrowserWindow({
    title: "Deepwatch",
    width: 1440,
    height: 1000,
    minWidth: 900,
    minHeight: 650,
    show: false,
    backgroundColor: "#101a23",
    icon: path.join(__dirname, "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (!isViewerURL(url, origin)) event.preventDefault();
  });
  const session = window.webContents.session;
  session.setPermissionCheckHandler(
    (contents, permission, requestOrigin) =>
      contents === window.webContents &&
      isViewerURL(requestOrigin, origin) &&
      permission === "pointerLock",
  );
  session.setPermissionRequestHandler((contents, permission, callback) =>
    callback(
      contents === window.webContents &&
        isViewerURL(contents.getURL(), origin) &&
        permission === "pointerLock",
    ),
  );
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: "File",
        submenu: [
          {
            label: "Choose Dwarf Fortress folder…",
            click: async () => {
              if (await chooseFolder()) launchCompanion().catch(fail);
            },
          },
          {
            label: "Restart companion",
            click: () => launchCompanion().catch(fail),
          },
          { type: "separator" },
          { role: "quit" },
        ],
      },
      {
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "togglefullscreen" },
          ...(!app.isPackaged ? [{ role: "toggleDevTools" }] : []),
        ],
      },
      {
        label: "Help",
        submenu: [
          {
            label: "Release and setup instructions",
            click: () =>
              shell.openExternal(
                "https://github.com/mbaldwinsmith/dwarf_fortress_voxel_viewer#readme",
              ),
          },
          {
            label: "Open log folder",
            click: () => shell.openPath(app.getPath("logs")),
          },
        ],
      },
    ]),
  );
  if (
    !smoke &&
    !validInstallation(readConfig(configFile()).dfPath) &&
    !validInstallation(process.env.DF_PATH) &&
    !validInstallation(
      path.join(
        process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
        "Steam",
        "steamapps",
        "common",
        "Dwarf Fortress",
      ),
    )
  )
    await chooseFolder();
  await launchCompanion();
  if (smoke) {
    let report;
    for (let attempt = 0; attempt < 100; attempt++) {
      report = await window.webContents.executeJavaScript(
        `({title:document.title,canvas:!!document.querySelector('#viewport canvas'),webgl:!!document.querySelector('canvas')?.getContext('webgl2'),nodeExposed:typeof require!=='undefined',location:location.href,status:document.querySelector('#status')?.textContent})`,
      );
      if (
        report.canvas &&
        report.status &&
        !/^(Connecting to local companion|Companion disconnected|Cannot reach local)/.test(
          report.status,
        )
      )
        break;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (
      !report.canvas ||
      !report.webgl ||
      report.nodeExposed ||
      /^(Connecting to local companion|Companion disconnected|Cannot reach local)/.test(
        report.status,
      )
    )
      throw Error(`Desktop smoke check failed: ${JSON.stringify(report)}`);
    if (process.env.DEEPWATCH_SMOKE_REPORT)
      fs.writeFileSync(
        process.env.DEEPWATCH_SMOKE_REPORT,
        JSON.stringify({ ...report, packaged: app.isPackaged }, null, 2),
      );
    console.log("Deepwatch desktop smoke check passed", report);
    await stopCompanion();
    app.exit(0);
  }
}
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  quitting = true;
  child?.kill();
  child = undefined;
});
