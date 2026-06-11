/**
 * electron-builder beforePack：在打入 asar 前再次裁剪 node_modules。
 * 避免 pack 阶段重新收集依赖后带入多余平台包（Linux CI 上尤为明显）。
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** @param {import("app-builder-lib").BeforePackContext} context */
export default async function beforePack(context) {
  const plat = context.electronPlatformName;
  const arch = context.arch === 3 ? "arm64" : "x64";
  execSync(`node scripts/prune-pack-deps.mjs --platform ${plat} --arch ${arch}`, {
    cwd: context.packager.info.projectDir ?? root,
    stdio: "inherit",
  });
}
