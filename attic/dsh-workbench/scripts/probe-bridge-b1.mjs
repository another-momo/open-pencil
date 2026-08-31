/**
 * probe-bridge-b1.mjs — T16/B1 探针：packages/mcp server standalone 复用性实测。
 *
 * 判据（T16-plan §1.2-1）：server 能否脱离旧编辑器进程独立启动，且支持
 * 三角色协议——editor 客户端 register / 工具侧 auth + /rpc 中继 / 负例拒绝。
 * 探针在 7601 跑（7600 被 spike 桩占用，不干扰 dev 回路）。
 *
 * 运行：node workbench/scripts/probe-bridge-b1.mjs   （仓库根目录下）
 */

import { startServer } from "../../packages/mcp/dist/server.mjs";
import WebSocket from "ws";

const PORT = 7601;
const TOKEN = "probe-token-t16-b1";
const results = [];
const rec = (name, pass, detail) => {
	results.push({ name, pass, detail });
	console.log(`${pass ? "PASS" : "FAIL"} ${name}: ${JSON.stringify(detail)}`);
};

const server = await startServer({
	httpPort: PORT,
	withTcp: true,
	socketPath: null,
	authToken: TOKEN,
});
rec("server-start", true, { httpPort: server.httpPort });

try {
	// 1. /health 无客户端时应如实报 no_app
	const health0 = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
	rec("health-no-app", health0.status === "no_app", health0);

	// 2. editor 客户端：WS 连接 → 等 register 提示（不含 token）→ 带 token register
	const editor = new WebSocket(`ws://127.0.0.1:${PORT}/`);
	const prompt = await new Promise((resolve, reject) => {
		editor.once("message", (raw) => resolve(JSON.parse(String(raw))));
		editor.once("error", reject);
		setTimeout(() => reject(new Error("register prompt timeout")), 5000);
	});
	rec(
		"register-prompt-no-token-leak",
		prompt.type === "register" && prompt.token === null,
		prompt,
	);

	const editorMessages = [];
	editor.on("message", (raw) => {
		const msg = JSON.parse(String(raw));
		editorMessages.push(msg);
		if (msg.type === "request" && msg.id) {
			// 伪编辑器：如实回显 command/args（探针只验中继，不接真内核——B2 才接）
			editor.send(JSON.stringify({ type: "response", id: msg.id, ok: true, result: { echoedCommand: msg.command, echoedArgs: msg.args ?? null } }));
		}
	});
	editor.send(JSON.stringify({ type: "register", token: TOKEN }));
	await new Promise((r) => setTimeout(r, 300));

	const health1 = await fetch(`http://127.0.0.1:${PORT}/health`).then((r) => r.json());
	rec("health-app-registered", health1.status === "ok", health1);

	// 3. 工具侧正例：POST /rpc 带 Bearer → 中继到 editor → 回包
	const rpcOk = await fetch(`http://127.0.0.1:${PORT}/rpc`, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
		body: JSON.stringify({ command: "getDocumentTree", args: { depth: 1 } }),
	});
	const rpcOkBody = await rpcOk.json();
	rec(
		"rpc-relay-roundtrip",
		rpcOk.status === 200 && rpcOkBody?.result?.echoedCommand === "getDocumentTree",
		{ status: rpcOk.status, body: rpcOkBody },
	);

	// 4. 工具侧负例：错 token POST /rpc 应 401/403
	const rpcBad = await fetch(`http://127.0.0.1:${PORT}/rpc`, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: "Bearer wrong-token" },
		body: JSON.stringify({ command: "getDocumentTree" }),
	});
	rec("rpc-wrong-token-rejected", rpcBad.status === 401 || rpcBad.status === 403, { status: rpcBad.status });

	// 5. editor 侧负例：错 token register 不应成为已注册浏览器
	const badEditor = new WebSocket(`ws://127.0.0.1:${PORT}/`);
	await new Promise((resolve) => {
		badEditor.once("message", () => {
			badEditor.send(JSON.stringify({ type: "register", token: "wrong-token" }));
			setTimeout(resolve, 400);
		});
	});
	const badMsgs = [];
	badEditor.on("message", (raw) => badMsgs.push(JSON.parse(String(raw))));
	await new Promise((r) => setTimeout(r, 300));
	rec("ws-wrong-token-not-registered", badEditor.readyState !== WebSocket.OPEN || badMsgs.some((m) => m.type === "error" || m.error), { readyState: badEditor.readyState, msgs: badMsgs });
	badEditor.close();

	// 6. 无注册客户端时的 RPC 错误语义：关掉 editor 后再调
	editor.close();
	await new Promise((r) => setTimeout(r, 300));
	const rpcNoApp = await fetch(`http://127.0.0.1:${PORT}/rpc`, {
		method: "POST",
		headers: { "content-type": "application/json", authorization: `Bearer ${TOKEN}` },
		body: JSON.stringify({ command: "getDocumentTree" }),
	});
	const rpcNoAppBody = await rpcNoApp.text();
	rec("rpc-no-app-honest-error", rpcNoApp.status >= 500 && /not connected/i.test(rpcNoAppBody), { status: rpcNoApp.status, body: rpcNoAppBody.slice(0, 160) });
} finally {
	await server.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\nB1 probe: ${results.length - failed.length}/${results.length} PASS`);
process.exit(failed.length ? 1 : 0);
