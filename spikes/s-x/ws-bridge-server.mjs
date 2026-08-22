/**
 * S-X-2 被测物：7600 WS 桥 server（编辑器进程侧组件的 spike 形态）。
 *
 * 对应 spikes/04 §7.1 第 2 项「7600 WS RPC ping/pong 1h 稳定 <1 disconnect」。
 * 形态参照终态架构 F0.2（WS/MCP 工具桥，127.0.0.1:7600）：host 侧工具经此桥
 * 调用编辑器 SceneGraph。本 spike 只验证桥的传输稳定性（ping/pong + echo RPC），
 * 不挂真实编辑器内核（X3 才接 SceneGraph）。
 *
 * 协议（刻意最小，JSON 文本帧）：
 *   → { "id": n, "method": "ping" }                    ← { "id": n, "result": "pong", "serverT": ms }
 *   → { "id": n, "method": "echo", "params": any }     ← { "id": n, "result": params }
 *   → { "id": n, "method": "apply_design",
 *       "params": { "patches": [{ "op": "set", "path": "nodes.<id>.props.<key>", "value": any }] } }
 *                                                   ← { "id": n, "result": { applied, diffMs, changedNodes } }
 * 另：server 每 25s 发 WS 协议层 ping 保活探针（ws 库 client 侧自动回 pong）。
 *
 * X3 迷你 SceneGraph：内存 JSON 文档（nodes 表），apply_design 应用 set 补丁后
 * 做逐节点引用对比求 diff（changedNodes），diffMs 用 performance.now() 计——
 * spike 03 §D3 的「diff < 50ms」判定指标就是这里的 diffMs。
 *
 * 运行：node ws-bridge-server.mjs [port]   （默认 7600，仅绑 127.0.0.1）
 * 环境变量 SPIKE_SCENE_NODES=n 可调整初始节点数（默认 8，X3 规模测试用）。
 */

import { WebSocketServer } from "ws";
import { performance } from "node:perf_hooks";

const port = Number(process.argv[2] ?? 7600);

// ---------------------------------------------------------------------------
// 迷你 SceneGraph（X3 被测物）：nodes 平表 + 每节点 props 字典
// ---------------------------------------------------------------------------

const nodeCount = Number(process.env.SPIKE_SCENE_NODES ?? 8);
const scene = { nodes: {} };
for (let i = 0; i < nodeCount; i++) {
	const id = `node-${i}`;
	scene.nodes[id] = {
		id,
		type: i % 2 === 0 ? "rect" : "text",
		props: { x: i * 10, y: i * 20, w: 100, h: 50, fill: "#ffffff", label: `item ${i}` },
	};
}

/** 按 "nodes.<id>.props.<key>" 路径写值；路径非法抛错（工具侧会以 error 帧收到）。 */
function applySetPatch(doc, path, value) {
	const parts = String(path).split(".");
	if (parts[0] !== "nodes" || parts.length < 2) throw new Error(`bad path: ${path}`);
	let target = doc;
	for (let i = 0; i < parts.length - 1; i++) {
		target = target[parts[i]];
		if (target === undefined || target === null) throw new Error(`path misses at ${parts[i]}: ${path}`);
	}
	target[parts[parts.length - 1]] = value;
}

/** 逐节点引用对比：patch 只替换引用，未触碰的节点保持同引用（迷你图天然成立）。 */
function diffSceneGraph(before, after) {
	const changed = [];
	const ids = new Set([...Object.keys(before.nodes), ...Object.keys(after.nodes)]);
	for (const id of ids) {
		if (before.nodes[id] !== after.nodes[id]) changed.push(id);
	}
	return changed;
}

function applyDesign(params) {
	const patches = params?.patches ?? [];
	// 结构化克隆出 before 引用集：patch 应用必须产生新节点对象才能 diff——
	// 这里照编辑器不可变更新惯例：被触碰路径的末级对象浅拷换新。
	const before = scene.nodes;
	const t0 = performance.now();
	const nextNodes = { ...scene.nodes };
	const copiedNodes = new Set();
	const copiedProps = new Set();
	for (const patch of patches) {
		if (patch.op !== "set") throw new Error(`unsupported op: ${patch.op}`);
		const parts = String(patch.path).split(".");
		// nodes.<id>… 开头的路径：先把节点（必要时连 props）浅拷换新引用再写，
		// 保证 diff 的引用对比能捕获变化（照编辑器不可变更新惯例的 spike 形态）
		if (parts[0] === "nodes" && parts.length >= 3 && nextNodes[parts[1]]) {
			if (!copiedNodes.has(parts[1])) {
				nextNodes[parts[1]] = { ...nextNodes[parts[1]] };
				copiedNodes.add(parts[1]);
			}
			if (parts[2] === "props" && !copiedProps.has(parts[1])) {
				nextNodes[parts[1]].props = { ...nextNodes[parts[1]].props };
				copiedProps.add(parts[1]);
			}
		}
		applySetPatch({ nodes: nextNodes }, patch.path, patch.value);
	}
	scene.nodes = nextNodes;
	const changedNodes = diffSceneGraph({ nodes: before }, scene);
	const diffMs = performance.now() - t0;
	return { applied: patches.length, diffMs, changedNodes };
}

const wss = new WebSocketServer({ host: "127.0.0.1", port });

wss.on("listening", () => {
	console.log(`[ws-bridge] listening on ws://127.0.0.1:${port}`);
});

wss.on("connection", (ws) => {
	console.log("[ws-bridge] client connected");
	ws.isAlive = true;
	ws.on("pong", () => {
		ws.isAlive = true;
	});
	ws.on("message", (data) => {
		let req;
		try {
			req = JSON.parse(data.toString());
		} catch {
			ws.send(JSON.stringify({ id: null, error: "bad json" }));
			return;
		}
		if (req.method === "ping") {
			ws.send(JSON.stringify({ id: req.id, result: "pong", serverT: Date.now() }));
		} else if (req.method === "echo") {
			ws.send(JSON.stringify({ id: req.id, result: req.params }));
		} else if (req.method === "apply_design") {
			try {
				ws.send(JSON.stringify({ id: req.id, result: applyDesign(req.params) }));
			} catch (err) {
				ws.send(JSON.stringify({ id: req.id, error: `apply_design: ${err.message}` }));
			}
		} else {
			ws.send(JSON.stringify({ id: req.id, error: `unknown method: ${req.method}` }));
		}
	});
	ws.on("close", () => console.log("[ws-bridge] client disconnected"));
	ws.on("error", (err) => console.log("[ws-bridge] client error:", err.message));
});

// 协议层保活：25s 间隔 ping，失活连接主动断开（便于 soak 统计真实断连）
const keepalive = setInterval(() => {
	for (const ws of wss.clients) {
		if (ws.isAlive === false) {
			ws.terminate();
			continue;
		}
		ws.isAlive = false;
		ws.ping();
	}
}, 25_000);

wss.on("close", () => clearInterval(keepalive));

process.on("SIGINT", () => {
	console.log("[ws-bridge] shutting down");
	wss.close();
	process.exit(0);
});
