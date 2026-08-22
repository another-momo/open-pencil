/**
 * copy-assets.mjs — 把 canvaskit.wasm 从 node_modules 拷进包内 assets/。
 *
 * 理由（T15/E1）：dsh 宿主只供 /plugins/<id>/client.js 白名单（serveBundle 源码实证），
 * wasm 由本插件注册的 webServer prefix 路由从包目录供出——资产必须随包自包含，
 * 不能依赖 node_modules 布局。幂等：大小一致即跳过。
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "node_modules", "canvaskit-wasm", "bin", "canvaskit.wasm");
const destDir = path.join(root, "assets");
const dest = path.join(destDir, "canvaskit.wasm");

if (!fs.existsSync(src)) {
	console.error(`copy-assets: 找不到 ${src} —— 先 npm ci`);
	process.exit(1);
}

const srcSize = fs.statSync(src).size;
if (fs.existsSync(dest) && fs.statSync(dest).size === srcSize) {
	console.log(`copy-assets: canvaskit.wasm 已是最新（${srcSize} bytes）`);
	process.exit(0);
}

fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(src, dest);
console.log(`copy-assets: canvaskit.wasm → assets/（${srcSize} bytes）`);
