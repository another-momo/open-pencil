/**
 * openpencil-marketing · host 侧（cordis 插件，dsh host Node 进程内）
 *
 * 三件事：
 *  1. bundled preset 安装：openpencil-design 首次复制到 DSH_HOME/.agent-presets（已存在则不动）
 *  2. systemPrompt 动态 section：marketing 选择项每次装配重新求值（T12/X6 实证机制）
 *  3. 工具注册：openpencil_apply_design（7600 WS 桥改画布）/ openpencil_set_marketing_type /
 *     openpencil_bridge_ping（连通性诊断）
 *  4. 静态资产路由（T15/E1）：宿主 serveBundle 只供 client.js 白名单（dsh-client-modules
 *     源码实证），canvaskit.wasm 等资产由本插件经 webServer 服务注册 prefix 路由供出——
 *     `/plugins/openpencil-marketing/assets/*` → 包内 assets/（webServer.register
 *     最长前缀优先，压过 dsh-client-modules 的 /plugins/ 前缀；dsh-host-webserver 源码实证）。
 *
 * 注册形态（weshop 实证）：ctx.tools.register，无 MCP 进程、无 JSON-RPC 子进程桥。
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

export const name = "openpencil-marketing";
export const inject = ["tools", "systemPrompt", "webServer"];

const BRIDGE_URL = process.env.OPENPENCIL_BRIDGE_URL || "ws://127.0.0.1:7600";

// ---------------------------------------------------------------------------
// 静态资产路由（T15/E1）：/plugins/openpencil-marketing/assets/* → <pkg>/assets/
// ---------------------------------------------------------------------------

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const assetsDirectory = path.join(packageRoot, "assets");
// 注意：webServer.match 要求 pathname === prefix 或 startsWith(prefix + "/")——
// 注册带尾斜杠的 prefix 会拼成双斜杠永不命中（dsh-host-webserver 源码实证 2026-08-22）。
const ASSETS_ROUTE_PREFIX = "/plugins/openpencil-marketing/assets";

const ASSET_CONTENT_TYPES = {
	".wasm": "application/wasm",
	".js": "text/javascript; charset=utf-8",
	".ttf": "font/ttf",
	".otf": "font/otf",
	".woff2": "font/woff2",
	".png": "image/png",
	".svg": "image/svg+xml",
};

function serveAsset(req, res) {
	if (req.method !== "GET" && req.method !== "HEAD") {
		res.writeHead(405);
		res.end();
		return;
	}
	const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
	const rel = pathname.slice(ASSETS_ROUTE_PREFIX.length + 1); // +1 吃掉分隔斜杠
	// 防目录逃逸：normalize 后必须仍落在 assetsDirectory 内
	const filePath = path.normalize(path.join(assetsDirectory, rel));
	if (!filePath.startsWith(assetsDirectory + path.sep)) {
		res.writeHead(403);
		res.end();
		return;
	}
	fs.readFile(filePath, (err, body) => {
		if (err) {
			res.writeHead(404);
			res.end();
			return;
		}
		res.writeHead(200, {
			"content-type": ASSET_CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
			"content-length": body.length,
			"cache-control": "no-cache",
		});
		res.end(body);
	});
}

// ---------------------------------------------------------------------------
// bundled preset：首次复制到 DSH_HOME/.agent-presets，已存在则不动（幂等）
// ---------------------------------------------------------------------------

const bundledPresetDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../presets/openpencil-design");

function installBundledPreset() {
	const compositionPath = path.join(bundledPresetDirectory, "agent.cordis.yml");
	const metadataPath = path.join(bundledPresetDirectory, "preset.yml");
	if (!fs.existsSync(compositionPath) || !fs.existsSync(metadataPath)) return { installed: false, reason: "bundled preset files missing" };

	const dshHome = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
	const presetDirectory = path.join(dshHome, ".agent-presets", "openpencil-design");
	if (fs.existsSync(presetDirectory)) return { installed: false, reason: "already present", presetDirectory };

	fs.mkdirSync(path.dirname(presetDirectory), { recursive: true });
	fs.cpSync(bundledPresetDirectory, presetDirectory, { recursive: true });
	return { installed: true, presetDirectory };
}

// ---------------------------------------------------------------------------
// marketing 选择项 → systemPrompt 动态 section
// 机制（T12/X6 源码+运行实证）：section 的 text 支持 `string | ((context) => string)`，
// 每次 prompt 装配都重新求值——section 函数读可变 store，工具切换 type 后下一轮装配即生效；
// 文本为空时该节在渲染期整体丢弃。
// ---------------------------------------------------------------------------

const marketingStore = { type: null }; // null = 未选择 → section 文本为空 → 渲染时整节丢弃

function marketingSectionText() {
	if (!marketingStore.type) return "";
	return [
		`The user is working on a marketing deliverable of type: ${marketingStore.type}.`,
		"Tailor layout, copy tone, and asset suggestions to that deliverable type.",
		"Acknowledge the current deliverable type in your next reply when it changes.",
	].join(" ");
}

/** 单条 WS 连接惰性复用：工具每次执行开短连接（常驻连接 + token 鉴权链属 T16 范围）。 */
export function callBridge(method, params, timeoutMs = 5000, bridgeUrl = BRIDGE_URL) {
	return new Promise((resolve, reject) => {
		const ws = new WebSocket(bridgeUrl);
		const timer = setTimeout(() => {
			ws.terminate();
			reject(new Error(`bridge timeout after ${timeoutMs}ms`));
		}, timeoutMs);
		ws.on("open", () => {
			ws.send(JSON.stringify({ id: 1, method, params }));
		});
		ws.on("message", (data) => {
			clearTimeout(timer);
			try {
				const resp = JSON.parse(data.toString());
				if (resp.error) reject(new Error(resp.error));
				else resolve(resp.result);
			} finally {
				ws.close();
			}
		});
		ws.on("error", (err) => {
			clearTimeout(timer);
			reject(new Error(`bridge connect failed: ${err.message}`));
		});
	});
}

/**
 * openpencil_apply_design 的 execute 本体（导出为离线驱动器的测试缝）。
 * 宿主侧经 `execute: (args) => applyDesignExecute(args)` 一元委托注册——dsh 会以
 * (args, execCtx) 二元调 execute（dsh-tools lib 实证 `.execute(exec.arguments, exec)`），
 * 直接赋值会把 execCtx 误当 bridgeUrl，故必须保留一元包装。
 */
export async function applyDesignExecute(args, bridgeUrl) {
	const t0 = Date.now();
	const result = await callBridge("apply_design", { patches: args?.patches ?? [] }, 5000, bridgeUrl);
	return { ok: true, bridgeMs: Date.now() - t0, result };
}

const output = {
	schema: {},
	render: (_args, value) => [{ type: "text", text: JSON.stringify(value, null, 2) }],
};

export function apply(ctx) {
	const presetInstall = installBundledPreset();
	console.log("[openpencil-marketing] preset install:", JSON.stringify(presetInstall));

	ctx.effect(() =>
		ctx.webServer.register({
			kind: "prefix",
			path: ASSETS_ROUTE_PREFIX,
			handler: serveAsset,
		}),
	);

	ctx.effect(() =>
		ctx.systemPrompt.section({
			name: "openpencil:marketing",
			order: 90,
			text: () => marketingSectionText(),
		}),
	);

	ctx.tools.register({
		name: "openpencil_set_marketing_type",
		description:
			"Set the current marketing deliverable type. Injected into the system prompt " +
			"as a dynamic section on the next assembly.",
		parameters: {
			type: "object",
			properties: { type: { type: "string", description: "e.g. poster / social-card / banner" } },
			required: ["type"],
		},
		output,
		execute: async (args) => {
			marketingStore.type = String(args?.type ?? "");
			return { ok: true, marketingType: marketingStore.type };
		},
	});

	ctx.tools.register({
		name: "openpencil_apply_design",
		description:
			"Apply a design patch to the OpenPencil canvas scene graph via the 7600 WS bridge. " +
			"params.patches: array of { op: 'set', path: string, value: any }.",
		parameters: {
			type: "object",
			properties: {
				patches: {
					type: "array",
					items: {
						type: "object",
						properties: {
							op: { type: "string", enum: ["set"] },
							path: { type: "string" },
							value: {},
						},
						required: ["op", "path", "value"],
					},
				},
			},
			required: ["patches"],
		},
		output,
		execute: (args) => applyDesignExecute(args),
	});

	ctx.tools.register({
		name: "openpencil_bridge_ping",
		description: "Ping the 7600 WS bridge to diagnose editor connectivity.",
		parameters: { type: "object", properties: {} },
		output,
		execute: async () => {
			const t0 = Date.now();
			const result = await callBridge("ping");
			return { ok: true, bridgeMs: Date.now() - t0, result };
		},
	});

	return () => {};
}
