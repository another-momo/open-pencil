/**
 * S-X-3 离线驱动器：`openpencil_apply_design` 端到端 SceneGraph 改图（diff < 50ms）。
 *
 * 链路诚实性说明（D15/D19 纪律）：
 *   - 驱动器 import 插件 src/index.js 导出的 applyDesignExecute —— 与 cordis 工具
 *     注册里的 execute 是同一个函数引用，走的代码路径与 agent 面调用完全一致；
 *     唯一未被本驱动覆盖的是「模型自主决定调工具」这最后一程（无 API key，已按
 *     「阻塞即上报」纪律列入阻塞清单）。
 *   - 桥 server 以子进程真实启动（ws-bridge-server.mjs，7601 端口，避免与
 *     X2 的 7600 浸泡冲突），WS 帧走真实网络栈（127.0.0.1 loopback）。
 *
 * 判定：所有迭代的 result.diffMs < 50ms（spikes/04 §7.1 第 3 项）。
 *
 * 运行：node x3-apply-design.mjs
 */

import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { applyDesignExecute } from "./plugin/src/index.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const BRIDGE_PORT = 7601;
const BRIDGE_URL = `ws://127.0.0.1:${BRIDGE_PORT}`;

const results = [];
let failures = 0;

function check(name, ok, detail) {
	results.push({ name, ok, detail });
	if (!ok) failures++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function startBridge(nodeCount) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, [path.join(here, "ws-bridge-server.mjs"), String(BRIDGE_PORT)], {
			env: { ...process.env, SPIKE_SCENE_NODES: String(nodeCount) },
			stdio: ["ignore", "pipe", "pipe"],
		});
		const timer = setTimeout(() => reject(new Error("bridge start timeout")), 10_000);
		child.stdout.on("data", (d) => {
			if (d.toString().includes("listening")) {
				clearTimeout(timer);
				resolve(child);
			}
		});
		child.stderr.on("data", (d) => process.stderr.write(`[bridge] ${d}`));
	});
}

function percentile(sorted, p) {
	return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

async function scenarioA() {
	console.log("\n--- 场景 A：8 节点文档，20 轮 × 3 patch ---");
	const diffs = [];
	const bridgeMs = [];
	for (let i = 0; i < 20; i++) {
		const out = await applyDesignExecute(
			{
				patches: [
					{ op: "set", path: "nodes.node-0.props.fill", value: `#ff${String(i).padStart(2, "0")}00` },
					{ op: "set", path: "nodes.node-1.props.x", value: i * 7 },
					{ op: "set", path: "nodes.node-2.props.label", value: `iter ${i}` },
				],
			},
			BRIDGE_URL,
		);
		diffs.push(out.result.diffMs);
		bridgeMs.push(out.bridgeMs);
		if (out.result.applied !== 3) check(`A iter ${i} applied==3`, false, JSON.stringify(out));
	}
	const sorted = [...diffs].sort((a, b) => a - b);
	check("A: 全部 20 轮 diffMs < 50ms", diffs.every((d) => d < 50), `min=${sorted[0].toFixed(3)} p50=${percentile(sorted, 50).toFixed(3)} p95=${percentile(sorted, 95).toFixed(3)} max=${sorted[sorted.length - 1].toFixed(3)}`);
	check("A: 全部 20 轮桥往返 bridgeMs < 50ms", bridgeMs.every((d) => d < 50), `max=${Math.max(...bridgeMs)}`);
	return { diffs, bridgeMs };
}

async function scenarioB() {
	console.log("\n--- 场景 B：状态持续性与 diff 正确性 ---");
	const first = await applyDesignExecute(
		{ patches: [{ op: "set", path: "nodes.node-3.props.fill", value: "#00ff00" }] },
		BRIDGE_URL,
	);
	check("B: 第一次 patch changedNodes == [node-3]", JSON.stringify(first.result.changedNodes) === JSON.stringify(["node-3"]), JSON.stringify(first.result.changedNodes));
	const second = await applyDesignExecute(
		{ patches: [{ op: "set", path: "nodes.node-4.props.fill", value: "#0000ff" }] },
		BRIDGE_URL,
	);
	check(
		"B: 第二次 patch changedNodes 只含 node-4（node-3 的改动已沉淀、不误报）",
		JSON.stringify(second.result.changedNodes) === JSON.stringify(["node-4"]),
		JSON.stringify(second.result.changedNodes),
	);
	return { first: first.result, second: second.result };
}

async function scenarioC() {
	console.log("\n--- 场景 C：错误路径（坏 path 必须 error 帧，不静默） ---");
	try {
		await applyDesignExecute({ patches: [{ op: "set", path: "nodes.ghost.props.fill", value: 1 }] }, BRIDGE_URL);
		check("C: 坏路径被拒绝", false, "未抛错");
	} catch (err) {
		check("C: 坏路径被拒绝", /apply_design/.test(err.message), err.message);
	}
	try {
		await applyDesignExecute({ patches: [{ op: "delete", path: "nodes.node-0", value: null }] }, BRIDGE_URL);
		check("C: 不支持 op 被拒绝", false, "未抛错");
	} catch (err) {
		check("C: 不支持 op 被拒绝", /unsupported op/.test(err.message), err.message);
	}
}

async function main() {
	console.log("S-X-3 离线驱动器", BRIDGE_URL);
	let bridge = await startBridge(8);
	const a = await scenarioA();
	const b = await scenarioB();
	await scenarioC();
	bridge.kill("SIGINT");
	await new Promise((r) => setTimeout(r, 300));

	// 场景 D：1000 节点规模
	console.log("\n--- 场景 D：1000 节点文档，10 patch 触碰 10 节点 ---");
	bridge = await startBridge(1000);
	const patches = Array.from({ length: 10 }, (_, i) => ({
		op: "set",
		path: `nodes.node-${i * 100}.props.fill`,
		value: "#123456",
	}));
	const dRuns = [];
	for (let i = 0; i < 5; i++) {
		const out = await applyDesignExecute({ patches: patches.map((p, j) => ({ ...p, value: `#12345${i}${j}` })) }, BRIDGE_URL);
		dRuns.push(out.result.diffMs);
		if (i === 0) check("D: changedNodes 命中 10 个目标节点", out.result.changedNodes.length === 10, `got ${out.result.changedNodes.length}`);
	}
	const dSorted = [...dRuns].sort((x, y) => x - y);
	check("D: 1000 节点下全部 diffMs < 50ms", dRuns.every((d) => d < 50), `min=${dSorted[0].toFixed(3)} max=${dSorted[dSorted.length - 1].toFixed(3)}`);
	bridge.kill("SIGINT");

	const summary = {
		item: "X3 openpencil_apply_design end-to-end, diff < 50ms",
		date: new Date().toISOString().slice(0, 10),
		bridge: BRIDGE_URL,
		scenarios: {
			A: { nodes: 8, iterations: 20, diffMs: a.diffs.map((d) => Number(d.toFixed(3))), bridgeMs: a.bridgeMs },
			B: { first: b.first, second: b.second },
			C: "见 results",
			D: { nodes: 1000, diffMs: dRuns.map((d) => Number(d.toFixed(3))) },
		},
		results,
		failures,
		verdict: failures === 0 ? "PASS" : "FAIL",
	};
	fs.writeFileSync(path.join(here, "evidence", "x3-apply-design-result.json"), JSON.stringify(summary, null, 2));
	console.log(`\n=== X3 ${summary.verdict}（failures=${failures}）→ evidence/x3-apply-design-result.json`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("driver error:", err);
	process.exit(2);
});
