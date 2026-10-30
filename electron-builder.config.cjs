module.exports = {
  appId: "com.mbaldwinsmith.deepwatch",
  productName: "Deepwatch",
  directories: { output: "release", buildResources: "build" },
  asar: true,
  // The application UI is English; retain both shipped English locales.
  electronLanguages: ["en-US", "en-GB"],
  npmRebuild: false,
  files: [
    "dist/viewer/**/*",
    "dist/bridge/**/*",
    "desktop/**/*",
    "package.json",
    "LICENSE",
    // Runtime JS and its notices are bundled into dist/bridge.
    "!node_modules/**/*",
  ],
  win: {
    target: ["nsis", "zip"],
    icon: "build/icon.ico",
    artifactName: "Deepwatch-${version}-${arch}.${ext}",
  },
  nsis: {
    artifactName: "Deepwatch-Setup-${version}-${arch}.${ext}",
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    deleteAppDataOnUninstall: false,
  },
  publish: null,
};
