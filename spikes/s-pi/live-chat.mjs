/**
 * S-pi-1 活模型面（T18 P2）：真实 openrouter/free 经 pi SDK 库形态跑通一轮流式对话。
 *
 * 与 offline-echo.mjs 的差异：不注入 faux provider，走真实网络与真实模型。
 * 模型配置：openrouter/free 非 pi-ai 内置目录模型，经 models.json 覆盖内置
 * openrouter provider 注入（docs/models.md §Overriding Built-in Providers 路径）。
 *
 * 验证目标（spikes/02 §6 S-pi-1 活模型面）：
 *  1. createAgentSession 库形态 + 真实 openrouter provider 装配成功
 *  2. 流式事件序列完整（text_delta 增量拼接 == 最终 assistant 文本）
 *  3. 回复非空且语义连贯（对 1+1 问题的回答含「2」）
 *  4. usage 非零（真实计费回包）
 *
 * 运行：OPENROUTER_API_KEY=... node live-chat.mjs  （退出码 0 = 全过；key 缺失显式报错）
 * key 卫生：只读环境变量，不打印、不落盘。
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
} from "@earendil-works/pi-coding-agent";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
	console.error("FAIL: OPENROUTER_API_KEY 未设置（从 owner 配置源注入，勿硬编码）");
	process.exit(1);
}

const failures = [];
function check(label, cond, detail) {
	if (cond) console.log(`  PASS ${label}`);
	else {
		console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
		failures.push(label);
	}
}

const tempDir = mkdtempSync(join(tmpdir(), "s-pi-live1-"));
const agentDir = mkdtempSync(join(tmpdir(), "s-pi-live1-agent-"));

// openrouter/free 经 models.json 覆盖注入内置 openrouter provider
// （baseUrl 沿用内置 https://openrouter.ai/api/v1，此处只补 apiKey 引用与模型条目）
writeFileSync(
	join(agentDir, "models.json"),
	JSON.stringify({
		providers: {
			openrouter: {
				apiKey: "$OPENROUTER_API_KEY",
				models: [
					{
						id: "openrouter/free",
						name: "OpenRouter Free (meta route)",
						api: "openai-completions",
						reasoning: false,
						input: ["text"],
						cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
						contextWindow: 65536,
						maxTokens: 8192,
					},
				],
			},
		},
	}),
);

try {
	const modelRuntime = await ModelRuntime.create({
		authPath: join(agentDir, "auth.json"),
		modelsPath: join(agentDir, "models.json"),
	});

	const model = modelRuntime.getModel("openrouter", "openrouter/free");
	check("getModel(openrouter/openrouter-free) 命中", !!model);

	const { session } = await createAgentSession({
		cwd: tempDir,
		agentDir,
		model,
		modelRuntime,
		sessionManager: SessionManager.inMemory(),
	});

	const deltas = [];
	session.subscribe((event) => {
		if (event.type === "message_update" && event.assistantMessageEvent?.type === "text_delta") {
			deltas.push(event.assistantMessageEvent.delta);
		}
	});

	console.log("  prompt 发送（openrouter/free 首 token 可能数秒）...");
	const promptAt = Date.now();
	await session.prompt("用一句话回答：1+1 等于几？只回答答案本身。");
	const latencyMs = Date.now() - promptAt;

	// 终态断言走 session.state.messages（与 offline-echo.mjs 已证模式一致）
	const roles = session.state.messages.map((m) => m.role);
	const finalMsg = session.state.messages[session.state.messages.length - 1];
	const finalText = finalMsg?.role === "assistant"
		? finalMsg.content.filter((b) => b.type === "text").map((b) => b.text).join("")
		: null;
	const usageSeen = finalMsg?.usage ?? null;
	const stopReason = finalMsg?.stopReason;

	check("消息结构 user→assistant", roles.join("→") === "user→assistant", roles.join(","));
	check("末条 assistant 非 error/aborted 终态", finalMsg?.role === "assistant" && stopReason !== "error" && stopReason !== "aborted", `stopReason=${stopReason}`);
	check("text_delta 增量序列非空", deltas.length > 0, `deltas=${deltas.length}`);
	check("增量拼接 == 最终文本", deltas.join("") === finalText, `joined=${deltas.join("").length} final=${finalText?.length}`);
	check("回复非空", !!finalText && finalText.length > 0);
	check("回复语义连贯（含「2」）", !!finalText && finalText.includes("2"), finalText?.slice(0, 80));
	check("usage 非零", !!usageSeen && (usageSeen.output ?? usageSeen.outputTokens ?? 0) > 0, JSON.stringify(usageSeen));

	console.log(`  实测：首轮回合 ${latencyMs}ms，回复 ${finalText?.length ?? 0} 字符，delta ${deltas.length} 片`);
	console.log(`  回复内容：${finalText?.slice(0, 120)}`);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}

if (failures.length) {
	console.error(`\nFAIL ${failures.length} 项：${failures.join(" / ")}`);
	process.exit(1);
}
console.log("\nS-pi-1 活模型面全过");
