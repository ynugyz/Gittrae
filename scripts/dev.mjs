import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 统一入口；兼容人员2的.mjs服务，未接入时网页仍可独立启动。
const root = fileURLToPath(new URL("../", import.meta.url));
const children = [];
function run(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  children.push(child);
  child.on("exit", (code) => {
    if (code) {
      stop();
      process.exitCode = code;
    }
  });
}
function stop() {
  children.forEach((child) => child.kill());
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const service = ["server/index.mjs", "server/index.ts"].find((path) =>
  existsSync(new URL(`../${path}`, import.meta.url)),
);
if (service) {
  const envArgs = existsSync(new URL("../.env", import.meta.url))
    ? ["--env-file=.env"]
    : [];
  run([
    ...envArgs,
    ...(service.endsWith(".ts") ? ["--import", "tsx"] : []),
    service,
  ]);
} else {
  console.log("本机服务尚未接入：界面可启动，统计与实时 AI 暂不可用。");
}
run(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"]);
