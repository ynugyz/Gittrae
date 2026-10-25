import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// 统一入口；server/index.ts 由人员2接入，未接入时网页仍可独立启动。
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
if (existsSync(new URL("../server/index.ts", import.meta.url))) {
  const envArgs = existsSync(new URL("../.env", import.meta.url))
    ? ["--env-file=.env"]
    : [];
  run([...envArgs, "--import", "tsx", "server/index.ts"]);
} else {
  console.log("模型服务尚未接入：统计与界面可独立运行，实时 AI 不可用。");
}
run(["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"]);
