/**
 * S-pi-2 主线活模型面（T18 P3）：真实模型调用自定义文本工具并消费其返回续跑。
 *
 * 对应 spike 02 §6 S-pi-2 主线（look 通道 B 的 pi 侧暴露面）：主对话 text-only，
 * 自定义工具返回纯文本/结构化 tool-result，agent 正确消费并续跑——DeepSeek 系/
 * openrouter 文本路径原生兼容，无降级路径。本脚本用含唯一标记串的场景摘要文本
 * 模拟 look 的真实返回结构。
 *
 * 验证目标：
 *  1. 真实模型（openrouter/free）对自定义工具发起真实工具调用
 *  2. 工具 execute 在我们进程内执行（tool_execution_start/end 成对 + 计数）
 *  3. toolResult 进入会话消息结构（user→assistant→toolResult→assistant）
 *  4. 模型后续回复引用工具返回的标记串（消费续跑实证）
 *
 * 已知模型档位约束（dsh 线 T17 实测）：openrouter/free 需要显式参数指令才稳定
 * 调工具；脚本用显式指令模板。若模型只口述不调用或丢参数，如实 FAIL 重试，
 * 不伪造通过。
 *
 * 运行：OPENROUTER_API_KEY=... node live-tool-result.mjs  （退出码 0 = 全过）
 */

import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
	defineTool,
} from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
	console.error("FAIL: OPENROUTER_API_KEY 未设置（从 owner 配置源注入，勿硬编码）");
	process.exit(1);
}

const MARKER = "SCENE-MARK-7f3a2c";
let toolExecutions = 0;

const sceneSummaryTool = defineTool({
	name: "scene_summary",
	label: "Scene Summary",
	description: "Returns a structured text summary of the current design canvas scene.",
	promptSnippet: "scene_summary: get current canvas scene summary as text",
	parameters: Type.Object({
		detail: Type.Union([Type.Literal("brief")], {
			description: "Detail level. Must be \"brief\".",
		}),
	}),
	execute: async (_toolCallId, params) => {
		toolExecutions++;
		return {
			content: [
				{
					type: "text",
					text: `${MARKER} scene: frames=1 rects=2 bg=#FAFAFA detail=${params.detail}`,
				},
			],
			details: {},
		};
	},
});

const failures = [];
function check(label, cond, detail) {
	if (cond) console.log(`  PASS ${label}`);
	else {
		console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
		failures.push(label);
	}
}

const tempDir = mkdtempSync(join(tmpdir(), "s-pi-live2-"));
const agentDir = mkdtempSync(join(tmpdir(), "s-pi-live2-agent-"));

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
		customTools: [sceneSummaryTool],
		tools: ["scene_summary"], // allowlist：只开本工具
	});

	const events = [];
	session.subscribe((event) => events.push(event));

	// 显式参数指令（免费档纪律）：逐字给参数，要求只调工具
	const promptText =
		"立即调用 scene_summary 工具，参数逐字照抄：{\"detail\":\"brief\"}。" +
		"调用后把工具返回内容里的标记串（SCENE-MARK 开头）原样复述给我。";
	console.log("  prompt 发送（显式参数指令）...");
	const promptAt = Date.now();
	await session.prompt(promptText);
	const latencyMs = Date.now() - promptAt;

	const timeline = events.map((e) =>
		e.type === "message_update" ? `message_update(${e.assistantMessageEvent?.type})` : e.type,
	);
	console.log("  事件时间线:", timeline.join(" → ").slice(0, 400));

	check("工具被真实执行 1 次", toolExecutions === 1, `actual=${toolExecutions}`);
	check(
		"tool_execution_start/end 成对且无错",
		events.some((e) => e.type === "tool_execution_start" && e.toolName === "scene_summary") &&
			events.some((e) => e.type === "tool_execution_end" && e.toolName === "scene_summary" && !e.isError),
	);

	const roles = session.state.messages.map((m) => m.role);
	console.log("  messages roles:", roles.join(" → "));
	check(
		"消息结构 user→assistant→toolResult→assistant",
		roles.length === 4 &&
			roles[0] === "user" &&
			roles[1] === "assistant" &&
			roles[2] === "toolResult" &&
			roles[3] === "assistant",
		roles.join(","),
	);

	const toolResult = session.state.messages[2];
	const resultText = toolResult?.content?.find?.((c) => c.type === "text")?.text;
	check("toolResult 含标记串", !!resultText && resultText.includes(MARKER), resultText?.slice(0, 80));

	const finalMsg = session.state.messages[3];
	const finalText = finalMsg?.content?.filter?.((b) => b.type === "text").map((b) => b.text).join("");
	check("模型续跑回复引用标记串", !!finalText && finalText.includes(MARKER), finalText?.slice(0, 120));

	console.log(`  实测：回合 ${latencyMs}ms；模型回复：${finalText?.slice(0, 120)}`);
} finally {
	rmSync(tempDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}

if (failures.length) {
	console.error(`\nFAIL ${failures.length} 项：${failures.join(" / ")}`);
	process.exit(1);
}
console.log("\nS-pi-2 主线活模型面全过");
