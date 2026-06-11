/**
 * electron-builder beforePack：在打入 asar 前再次裁剪 node_modules。
 * 除项目根 node_modules 外，也裁剪已复制到 app 暂存目录的 node_modules（Linux x64 CI 上常见膨胀点）。
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {string} cwd
 * @param {string} plat
 * @param {string} arch
 * @param {string | null} nodeModules
 */
function runPrune(cwd, plat, arch, nodeModules = null) {
  const args = [
    "scripts/prune-pack-deps.mjs",
    "--platform",
    plat,
    "--arch",
    arch,
  ];
  if (nodeModules) {
    args.push("--node-modules", nodeModules);
  }
  execSync(`node ${args.map((a) => JSON.stringify(a)).join(" ")}`, {
    cwd,
    stdio: "inherit",
  });
}

/** @param {import("app-builder-lib").BeforePackContext} context */
export default async function beforePack(context) {
  const plat = context.electronPlatformName;
  const arch = context.arch === 3 ? "arm64" : "x64";
  const projectDir = context.packager.info.projectDir ?? root;

  runPrune(projectDir, plat, arch);

  const appNm = path.join(context.appOutDir, "resources", "app", "node_modules");
  if (fs.existsSync(appNm)) {
    runPrune(projectDir, plat, arch, appNm);
  }
}
