/**
 * copy-assets.mjs — 把运行时资产拷进包内 assets/（幂等：大小一致即跳过）。
 *
 * 理由（T15/E1）：dsh 宿主只供 /plugins/<id>/client.js 白名单（serveBundle 源码实证），
 * wasm/字体由本插件注册的 webServer prefix 路由从包目录供出——资产必须随包自包含，
 * 不能依赖 node_modules 或仓根 public/ 布局。
 *
 * 清单：
 *  - canvaskit.wasm ← node_modules/canvaskit-wasm/bin/（E1：island 内 CanvasKit 初始化）
 *  - Inter-Regular.ttf ← 仓根 public/（E2：renderer loadFonts 必装 Inter Regular，
 *    原路径是根相对 /Inter-Regular.ttf 字面量，island 场景由 markLoaded 预填挡掉该 fetch）
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = path.resolve(root, "..");
const destDir = path.join(root, "assets");

const ASSETS = [
	{ src: path.join(root, "node_modules", "canvaskit-wasm", "bin", "canvaskit.wasm"), name: "canvaskit.wasm" },
	{ src: path.join(repoRoot, "public", "Inter-Regular.ttf"), name: "Inter-Regular.ttf" },
];

fs.mkdirSync(destDir, { recursive: true });
for (const { src, name } of ASSETS) {
	if (!fs.existsSync(src)) {
		console.error(`copy-assets: 找不到 ${src}`);
		process.exit(1);
	}
	const dest = path.join(destDir, name);
	const srcSize = fs.statSync(src).size;
	if (fs.existsSync(dest) && fs.statSync(dest).size === srcSize) {
		console.log(`copy-assets: ${name} 已是最新（${srcSize} bytes）`);
		continue;
	}
	fs.copyFileSync(src, dest);
	console.log(`copy-assets: ${name} → assets/（${srcSize} bytes）`);
}

