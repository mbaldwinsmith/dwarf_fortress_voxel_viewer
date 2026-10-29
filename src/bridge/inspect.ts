import "dotenv/config";
import { inspectInstallation } from "./installation.js";
if (!process.env.DF_PATH)
  throw Error("Set DF_PATH in .env to inspect your installation");
console.log(
  JSON.stringify(await inspectInstallation(process.env.DF_PATH), null, 2),
);
