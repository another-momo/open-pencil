/**
 * openpencil-marketing · host 侧（cordis 插件，dsh host Node 进程内）
 *
 * 三件事：
 *  1. bundled preset 安装：openpencil-design 首次复制到 DSH_HOME/.agent-presets（已存在则不动）
 *  2. systemPrompt 动态 section：marketing 选择项每次装配重新求值（T12/X6 实证机制）
 *  3. 工具注册（T16/B3 真链路）：openpencil_apply_design（经 7600 真桥改 island 活画布）/
 *     openpencil_set_marketing_type / openpencil_bridge_ping（连通性诊断）
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

export const name = "openpencil-marketing";
export const inject = ["tools", "systemPrompt", "webServer"];


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
// bridge-token 路由（T16/B2）：island 浏览器侧读不了文件，token 经本路由同源下发。
// 链路：packages/mcp server 写 discovery 文件（明文 token，文件头自带告警）→
// 本插件 node 侧读 → island fetch 同源取。威胁模型不扩面：同用户本机进程本就
// 可读 discovery 文件（T16-self-check §2.2 第 4 条）。
// ---------------------------------------------------------------------------

// 路径解析镜像 packages/mcp/src/transport/paths.ts（2026-08-22 读源码对齐）
function bridgeDiscoveryPath() {
	if (process.env.OPENPENCIL_MCP_DISCOVERY_PATH) return process.env.OPENPENCIL_MCP_DISCOVERY_PATH;
	const home = os.homedir();
	if (process.platform === "win32") {
		return path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "OpenPencil", "mcp.json");
	}
	if (process.platform === "darwin") {
		return path.join(home, "Library", "Application Support", "OpenPencil", "mcp.json");
	}
	const runtime = process.env.XDG_RUNTIME_DIR;
	return runtime ? path.join(runtime, "openpencil", "mcp.json") : path.join(home, ".openpencil", "mcp.json");
}

async function readBridgeDiscovery() {
	const raw = await fs.promises.readFile(bridgeDiscoveryPath(), "utf-8");
	const info = JSON.parse(raw);
	if (!info || typeof info.httpPort !== "number") throw new Error("discovery file missing httpPort");
	return info;
}

const BRIDGE_TOKEN_ROUTE = "/plugins/openpencil-marketing/bridge-token";

async function serveBridgeToken(req, res) {
	if (req.method !== "GET") {
		res.writeHead(405);
		res.end();
		return;
	}
	try {
		const info = await readBridgeDiscovery();
		res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
		res.end(JSON.stringify({ port: info.httpPort, token: info.authToken ?? null }));
	} catch (err) {
		res.writeHead(503, { "content-type": "application/json; charset=utf-8" });
		res.end(JSON.stringify({ error: "bridge discovery unreadable: " + String(err?.message ?? err) }));
	}
}

/**
 * bridge-call 诊断缝（T16/B3）：POST {command, args} → 在宿主进程内走与工具完全
 * 相同的 callBridge 路径。存在理由：dsh 工具只能由 agent loop 触发（无 LLM key 时
 * 无法端到端驱动），本路由提供宿主进程内的真实执行证据。威胁模型同 bridge-token
 * 路由（同用户本机可读 discovery 明文 token，不扩面）。
 */
const BRIDGE_CALL_ROUTE = "/plugins/openpencil-marketing/bridge-call";

async function serveBridgeCall(req, res) {
	if (req.method !== "POST") {
		res.writeHead(405);
		res.end();
		return;
	}
	let raw = "";
	req.on("data", (c) => { raw += c; });
	req.on("end", async () => {
		try {
			const body = JSON.parse(raw || "{}");
			// apply_design 走工具 execute 本体（补丁翻译 + 逐条执行），其余命令裸桥调用
			const result = body.command === "apply_design"
				? await applyDesignExecute(body.args)
				: await callBridge(String(body.command ?? ""), body.args);
			res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify(result));
		} catch (err) {
			res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
			res.end(JSON.stringify({ ok: false, error: String(err?.message ?? err) }));
		}
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

/**
 * 真桥调用（T16/B3）：discovery 文件读 {httpPort, authToken} → POST /rpc（Bearer）。
 * 协议/鉴权为 packages/mcp server 原生面（B1 探针 8/8 实证）；错误原样上抛，不伪造成功。
 */
export async function callBridge(command, args, timeoutMs = 5000) {
	const info = await readBridgeDiscovery();
	const resp = await fetch(`http://127.0.0.1:${info.httpPort}/rpc`, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${info.authToken}` },
		body: JSON.stringify({ command, args }),
		signal: AbortSignal.timeout(timeoutMs),
	});
	const text = await resp.text();
	if (!resp.ok) throw new Error(`bridge /rpc HTTP ${resp.status}: ${text.slice(0, 300)}`);
	return JSON.parse(text);
}

/**
 * openpencil_apply_design 的 execute 本体（导出为离线驱动器的测试缝）。
 * 宿主侧经 `execute: (args) => applyDesignExecute(args)` 一元委托注册——dsh 会以
 * (args, execCtx) 二元调 execute（dsh-tools lib 实证 `.execute(exec.arguments, exec)`），
 * 直接赋值会把 execCtx 误当第二参，故必须保留一元包装。
 * patches 翻译为 island 最小命令面的 setProps 序列（T16-plan §1.2-3），逐条真实执行。
 */
export async function applyDesignExecute(args) {
	const t0 = Date.now();
	const patches = Array.isArray(args?.patches) ? args.patches : [];
	const applied = [];
	for (const p of patches) {
		if (p?.op !== "set") throw new Error(`unsupported op: ${p?.op}（已应用 ${applied.length} 条）`);
		const m = /^nodes\.([^.]+)\.props\.([^.]+)$/.exec(String(p?.path ?? ""));
		if (!m) throw new Error(`bad path: ${p?.path}（仅支持 nodes.<id>.props.<key>；已应用 ${applied.length} 条）`);
		const r = await callBridge("setProps", { nodeId: m[1], props: { [m[2]]: p.value } });
		if (!r?.ok) throw new Error(`bridge: ${r?.error ?? "unknown"}（已应用 ${applied.length} 条）`);
		applied.push({ nodeId: m[1], key: m[2], value: p.value });
	}
	return { ok: true, bridgeMs: Date.now() - t0, applied };
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
		ctx.webServer.register({
			kind: "exact",
			path: BRIDGE_TOKEN_ROUTE,
			handler: serveBridgeToken,
		}),
	);

	ctx.effect(() =>
		ctx.webServer.register({
			kind: "exact",
			path: BRIDGE_CALL_ROUTE,
			handler: serveBridgeCall,
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
			"Apply a design patch to the live in-island OpenPencil editor via the 7600 bridge. " +
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
		description: "Ping the live editor through the 7600 bridge to diagnose connectivity.",
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
