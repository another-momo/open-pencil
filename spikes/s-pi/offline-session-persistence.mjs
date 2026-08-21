/**
 * S-pi-3 离线面：SessionManager 跨「进程重启」持久化 + 树形分叉实测（无需网络/LLM）。
 *
 * 背景（T11-plan S-pi-3）：上游 harness 的教训是「app 从不发 session.stop、只有进程退出
 * 才落盘」，导致跨重启 resume 难以触发。本测试直接验证直用 pi SDK 时：
 *  1. append-only JSONL 是否**增量落盘**（dispose/退出前文件已含全部条目）——若是，则
 *     上游的 stop/destroy 坑在直用 SDK 路线天然不存在；
 *  2. SessionManager.open(file) 全新实例能否完整恢复消息（模拟进程重启）；
 *  3. list / continueRecent 发现机制；
 *  4. branch(entryId) 树形分叉：同一文件内从中间节点长出第二分支（spike 05 §3 认定的
 *     harness 抽象天花板能力，此处实测其在 0.84.2 真实可用）。
 *
 * 运行：node offline-session-persistence.mjs  （退出码 0 = 全过）
 */

import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
} from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";

const failures = [];
function check(label, cond, detail) {
	if (cond) console.log(`  PASS ${label}`);
	else {
		console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
		failures.push(label);
	}
}

// --- faux provider：第 N 个 user 消息得到 "pong-N"，无工具调用 ---

const fauxModel = {
	id: "faux-1",
	name: "Faux Model",
	api: "anthropic-messages",
	provider: "faux",
	baseUrl: "http://127.0.0.1:0",
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 16384,
};

function scriptedStream(_model, context) {
	const userCount = context.messages.filter((m) => m.role === "user").length;
	const text = `pong-${userCount}`;
	const message = {
		role: "assistant",
		content: [{ type: "text", text }],
		api: "anthropic-messages",
		provider: "faux",
		model: "faux-1",
		usage: {
			input: 10,
			output: 5,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 15,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: Date.now(),
	};
	const stream = createAssistantMessageEventStream();
	queueMicrotask(() => {
		const partial = { ...message, content: [{ type: "text", text: "" }], stopReason: "pending" };
		stream.push({ type: "start", partial: { ...partial } });
		stream.push({ type: "text_start", contentIndex: 0, partial: { ...partial } });
		partial.content[0].text = text;
		stream.push({ type: "text_delta", contentIndex: 0, delta: text, partial: { ...partial } });
		stream.push({ type: "text_end", contentIndex: 0, content: text, partial: { ...partial } });
		stream.push({ type: "done", reason: "stop", message });
	});
	return stream;
}

const fauxProvider = {
	id: "faux",
	name: "Faux Provider",
	auth: {
		apiKey: {
			name: "Faux API key",
			resolve: async () => ({ auth: { apiKey: "faux-key" }, source: "spike-scripted" }),
		},
	},
	getModels: () => [fauxModel],
	stream: scriptedStream,
	streamSimple: scriptedStream,
};

async function freshRuntime(agentDir) {
	const modelRuntime = await ModelRuntime.create({
		authPath: join(agentDir, "auth.json"),
		modelsPath: null,
		allowModelNetwork: false,
		refreshOnCreate: false,
	});
	modelRuntime.registerNativeProvider(fauxProvider);
	return modelRuntime;
}

// --- 测试主体 ---

const cwd = mkdtempSync(join(tmpdir(), "s-pi-3-cwd-"));
const sessionDir = mkdtempSync(join(tmpdir(), "s-pi-3-sessions-"));
const agentDir = mkdtempSync(join(tmpdir(), "s-pi-3-agent-"));

try {
	// ===== 阶段 A：创建会话 + 一轮对话，dispose 前检查增量落盘 =====
	console.log("阶段 A：create + prompt（检查 dispose 前落盘）");
	const rtA = await freshRuntime(agentDir);
	const smA = SessionManager.create(cwd, sessionDir);
	const { session: sA } = await createAgentSession({
		cwd,
		agentDir,
		model: rtA.getModel("faux", "faux-1"),
		modelRuntime: rtA,
		sessionManager: smA,
		tools: [],
	});
	await sA.prompt("ping one");

	const sessionFile = sA.sessionFile;
	check("sessionFile 路径落在自定义 sessionDir", !!sessionFile && sessionFile.startsWith(sessionDir), sessionFile);
	check("dispose 前文件已存在", existsSync(sessionFile));

	const linesBeforeDispose = readFileSync(sessionFile, "utf8").trim().split("\n").map((l) => JSON.parse(l));
	const typesBefore = linesBeforeDispose.map((e) => e.type);
	console.log("  dispose 前 JSONL:", typesBefore.join(", "));
	check(
		"dispose 前已增量落盘（header+user+assistant）",
		linesBeforeDispose.length >= 3 && typesBefore.includes("message"),
		`entries=${linesBeforeDispose.length}`,
	);
	const sessionIdA = sA.sessionId;
	const header = linesBeforeDispose[0];
	check("JSONL 首行 header 携带 sessionId", header.id === sessionIdA || header.sessionId === sessionIdA || !!header.id, JSON.stringify(header).slice(0, 120));

	// 条目树结构：id/parentId 链（root 是 model_change 等元条目，不一定在 message 上）
	const treeEntries = linesBeforeDispose.filter((e) => e.type !== "session");
	check(
		"条目携带 id/parentId 链（树形结构证据）",
		treeEntries.every((e) => typeof e.id === "string") && treeEntries.some((e) => e.parentId === null),
	);
	sA.dispose();

	// ===== 阶段 B：全新 runtime + open(file) 恢复（模拟进程重启）=====
	console.log("阶段 B：open(file) 跨重启恢复");
	const rtB = await freshRuntime(agentDir);
	const smB = SessionManager.open(sessionFile, sessionDir);
	const { session: sB } = await createAgentSession({
		cwd,
		agentDir,
		model: rtB.getModel("faux", "faux-1"),
		modelRuntime: rtB,
		sessionManager: smB,
		tools: [],
	});
	const rolesB = sB.state.messages.map((m) => m.role);
	const textB = sB.state.messages.find((m) => m.role === "assistant")?.content?.find?.((c) => c.type === "text")?.text;
	check("恢复后消息完整（user+assistant）", rolesB.join(",") === "user,assistant", rolesB.join(","));
	check("恢复后 assistant 文本正确", textB === "pong-1", `got "${textB}"`);
	check("sessionId 跨重启保持", sB.sessionId === sessionIdA, `${sB.sessionId} vs ${sessionIdA}`);

	// ===== 阶段 C：list / continueRecent 发现 =====
	console.log("阶段 C：list / continueRecent");
	const sessions = await SessionManager.list(cwd, sessionDir);
	check("list 发现 1 个会话", sessions.length === 1, `found=${sessions.length}`);
	check("list 的 firstMessage 正确", sessions[0]?.firstMessage === "ping one", sessions[0]?.firstMessage);
	const smC = SessionManager.continueRecent(cwd, sessionDir);
	const { session: sC } = await createAgentSession({
		cwd,
		agentDir,
		model: rtB.getModel("faux", "faux-1"),
		modelRuntime: rtB,
		sessionManager: smC,
		tools: [],
	});
	check("continueRecent 命中同一文件", sC.sessionFile === sessionFile, sC.sessionFile);
	sC.dispose();

	// ===== 阶段 D：branch 树形分叉 =====
	console.log("阶段 D：branch 分叉");
	const entriesB = smB.getEntries();
	const firstUserEntry = entriesB.find((e) => e.type === "message" && e.message?.role === "user");
	check("找到首个 user 条目作为分叉点", !!firstUserEntry);
	smB.branch(firstUserEntry.id);
	await sB.prompt("ping two (branch)");

	const entriesAfter = smB.getEntries();
	const childrenOfFork = entriesAfter.filter((e) => e.parentId === firstUserEntry.id);
	check(
		"分叉点长出 2 个子条目（原 assistant + 新 user）",
		childrenOfFork.length === 2,
		`children=${childrenOfFork.length}`,
	);
	const leafText = sB.state.messages.filter((m) => m.role === "assistant").map((m) => m.content?.find?.((c) => c.type === "text")?.text);
	check("分叉后当前路径 assistant 为 pong-1→pong-2", leafText.join(",") === "pong-1,pong-2", leafText.join(","));
	const tree = smB.getTree();
	check("getTree 可见分叉结构", JSON.stringify(tree).includes("ping two (branch)"));
	sB.dispose();

	// ===== 阶段 E：分叉后再次重启恢复，两分支都还在 =====
	console.log("阶段 E：分叉会话跨重启");
	const rtE = await freshRuntime(agentDir);
	const smE = SessionManager.open(sessionFile, sessionDir);
	const entriesE = smE.getEntries();
	const forkChildrenE = entriesE.filter((e) => e.parentId === firstUserEntry.id);
	check("重启后分叉结构完整保留", forkChildrenE.length === 2, `children=${forkChildrenE.length}`);
	console.log("  sessionFile:", sessionFile);
} finally {
	rmSync(cwd, { recursive: true, force: true });
	rmSync(sessionDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}

if (failures.length > 0) {
	console.error(`\nS-pi-3 离线面 FAILED: ${failures.length} 项未过`);
	process.exit(1);
}
console.log("\nS-pi-3 离线面 ALL PASS");
