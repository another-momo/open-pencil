/**
 * S-X-2 测量端：7600 WS 桥 1 小时 ping/pong 浸泡测试 client。
 *
 * 测量口径（对应 spikes/04 §7.1 第 2 项「< 1 disconnect」）：
 *  - 每 2s 一次应用层 ping RPC，记录 RTT；
 *  - 断连计数 = ws 'close' 事件次数（含 keepalive 失活被 server terminate 的情形）；
 *  - 断连后自动重连继续计时（重连本身计入 disconnects）；
 *  - 结束输出 JSON 摘要：duration / pings / failures / disconnects / RTT 分位数。
 *
 * 运行：node ws-bridge-soak.mjs [durationMin] [port]   （默认 60 分钟、7600）
 * 提前结束：收到 SIGINT 也会打印截至当前的摘要。
 */

import WebSocket from "ws";
import { writeFileSync } from "node:fs";

const durationMin = Number(process.argv[2] ?? 60);
const port = Number(process.argv[3] ?? 7600);
const url = `ws://127.0.0.1:${port}`;
const deadline = Date.now() + durationMin * 60_000;

const stats = {
	startedAt: new Date().toISOString(),
	durationMinPlanned: durationMin,
	connects: 0,
	disconnects: 0,
	pingsSent: 0,
	pongsOk: 0,
	pongTimeouts: 0,
	rttMs: [],
};
let ws;
let seq = 0;
let pingTimer;
let done = false;

function percentile(arr, p) {
	if (arr.length === 0) return null;
	const s = [...arr].sort((a, b) => a - b);
	return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))];
}

function finish(reason) {
	if (done) return;
	done = true;
	clearInterval(pingTimer);
	try {
		ws?.close();
	} catch {}
	stats.finishedAt = new Date().toISOString();
	stats.finishReason = reason;
	stats.durationMinActual = (Date.now() - new Date(stats.startedAt).getTime()) / 60_000;
	stats.rtt = { p50: percentile(stats.rttMs, 50), p95: percentile(stats.rttMs, 95), max: Math.max(...stats.rttMs) };
	delete stats.rttMs;
	const verdict = stats.disconnects < 1 && stats.pongTimeouts === 0 ? "PASS" : "FAIL";
	console.log(JSON.stringify({ verdict, ...stats }, null, 2));
	writeFileSync(
		new URL(`./x2-soak-result-${stats.startedAt.replaceAll(":", "-")}.json`, import.meta.url),
		JSON.stringify({ verdict, ...stats }, null, 2),
	);
	process.exit(verdict === "PASS" ? 0 : 1);
}

function connect() {
	ws = new WebSocket(url);
	ws.on("open", () => {
		stats.connects++;
		pingTimer = setInterval(() => {
			if (Date.now() > deadline) return finish("duration reached");
			const id = ++seq;
			const t0 = Date.now();
			stats.pingsSent++;
			const timeout = setTimeout(() => {
				stats.pongTimeouts++;
				ws.terminate();
			}, 5_000);
			ws.send(JSON.stringify({ id, method: "ping" }));
			const onMsg = (data) => {
				const resp = JSON.parse(data.toString());
				if (resp.id !== id) return;
				clearTimeout(timeout);
				ws.off("message", onMsg);
				if (resp.result === "pong") {
					stats.pongsOk++;
					stats.rttMs.push(Date.now() - t0);
				}
			};
			ws.on("message", onMsg);
		}, 2_000);
	});
	ws.on("close", () => {
		if (done) return;
		stats.disconnects++;
		clearInterval(pingTimer);
		if (Date.now() > deadline) return finish("duration reached (closed)");
		console.log(`[soak] disconnected (#${stats.disconnects}), reconnecting in 1s`);
		setTimeout(connect, 1_000);
	});
	ws.on("error", (err) => {
		console.log(`[soak] ws error: ${err.message}`);
	});
}

process.on("SIGINT", () => finish("SIGINT"));
connect();
console.log(`[soak] ${url} for ${durationMin}min, ping every 2s`);
