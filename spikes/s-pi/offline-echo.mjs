/**
 * S-pi-1 离线面：不经网络、不经真实 LLM，验证 pi SDK 库形态最小集成。
 *
 * 注入点：ModelRuntime.registerNativeProvider(fauxProvider) —— 自带 streamSimple
 * 返回编排好的 AssistantMessageEventStream（createAssistantMessageEventStream 来自
 * pi-ai 官方包，与 pi 自家 test/test-harness.ts 的 createFauxStreamFn 同一模式）。
 *
 * 验证目标（spikes/02 §6 S-pi-1 离线面 + T11-plan §1.2）：
 *  1. createAgentSession 库形态可编程创建（in-memory session，temp cwd/agentDir 隔离）
 *  2. customTools（defineTool）echo 工具被 agent loop 真实调用（tool_execution_* 事件）
 *  3. 事件流：message_update/text_delta 增量序列与最终文本一致
 *  4. session.state.messages 结构：user → assistant(toolCall) → toolResult → assistant(text)
 *  5. 全程零网络（faux provider 不发请求；ModelRuntime.create 禁网络刷新）
 *
 * 运行：node offline-echo.mjs  （退出码 0 = 全过）
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	createAgentSession,
	ModelRuntime,
	SessionManager,
	defineTool,
} from "@earendil-works/pi-coding-agent";
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { Type } from "typebox";

const FINAL_TEXT = "echo tool verified offline";
let echoExecutions = 0;

// ---------------------------------------------------------------------------
// Faux model + provider（脚本化两回合：T1 发起 echo 工具调用，T2 输出最终文本）
// ---------------------------------------------------------------------------

const fauxModel = {
	id: "faux-1",
	name: "Faux Model",
	api: "anthropic-messages",
	provider: "faux",
	baseUrl: "http://127.0.0.1:0", // 永不命中：faux provider 不发请求
	reasoning: false,
	input: ["text"],
	cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
	contextWindow: 128000,
	maxTokens: 16384,
};

function usage() {
	return {
		input: 100,
		output: 50,
		cacheRead: 0,
		cacheWrite: 0,
		totalTokens: 150,
		cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
	};
}

function assistantMessage(content, stopReason) {
	return {
		role: "assistant",
		content,
		api: "anthropic-messages",
		provider: "faux",
		model: "faux-1",
		usage: usage(),
		stopReason,
		timestamp: Date.now(),
	};
}

/** 按官方事件协议推流：start → (toolcall|text)_start/delta/end → done */
function pushMessage(stream, message) {
	const partial = { ...message, content: [], stopReason: "pending" };
	stream.push({ type: "start", partial: { ...partial } });

	for (let i = 0; i < message.content.length; i++) {
		const block = message.content[i];
		if (block.type === "text") {
			partial.content = [...partial.content, { type: "text", text: "" }];
			stream.push({ type: "text_start", contentIndex: i, partial: { ...partial } });
			// 固定 4 字符一切片，保证 text_delta 增量序列可断言
			for (let p = 0; p < block.text.length; p += 4) {
				const chunk = block.text.slice(p, p + 4);
				partial.content[i].text += chunk;
				stream.push({ type: "text_delta", contentIndex: i, delta: chunk, partial: { ...partial } });
			}
			stream.push({ type: "text_end", contentIndex: i, content: block.text, partial: { ...partial } });
		} else if (block.type === "toolCall") {
			partial.content = [
				...partial.content,
				{ type: "toolCall", id: block.id, name: block.name, arguments: {} },
			];
			stream.push({ type: "toolcall_start", contentIndex: i, partial: { ...partial } });
			stream.push({
				type: "toolcall_delta",
				contentIndex: i,
				delta: JSON.stringify(block.arguments),
				partial: { ...partial },
			});
			partial.content[i].arguments = block.arguments;
			stream.push({ type: "toolcall_end", contentIndex: i, toolCall: block, partial: { ...partial } });
		}
	}
	stream.push({ type: "done", reason: message.stopReason, message });
}

const streamCalls = [];

function scriptedStream(_model, context) {
	streamCalls.push(context);
	const sawToolResult = context.messages.some((m) => m.role === "toolResult");
	const stream = createAssistantMessageEventStream();
	queueMicrotask(() => {
		if (!sawToolResult) {
			pushMessage(
				stream,
				assistantMessage(
					[{ type: "toolCall", id: "faux_tc_1", name: "echo", arguments: { text: "hello pi" } }],
					"toolUse",
				),
			);
		} else {
			pushMessage(stream, assistantMessage([{ type: "text", text: FINAL_TEXT }], "stop"));
		}
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

// ---------------------------------------------------------------------------
// echo 工具（defineTool + customTools 直挂，不走 extension 文件）
// ---------------------------------------------------------------------------

const echoTool = defineTool({
	name: "echo",
	label: "Echo",
	description: "Echoes the input text back.",
	promptSnippet: "echo: echo text back",
	parameters: Type.Object({ text: Type.String() }),
	execute: async (_toolCallId, params) => {
		echoExecutions++;
		return { content: [{ type: "text", text: `echo:${params.text}` }], details: {} };
	},
});

// ---------------------------------------------------------------------------
// 会话装配与驱动
// ---------------------------------------------------------------------------

const tempDir = mkdtempSync(join(tmpdir(), "s-pi-1-"));
const agentDir = mkdtempSync(join(tmpdir(), "s-pi-1-agent-"));

const failures = [];
function check(label, cond, detail) {
	if (cond) console.log(`  PASS ${label}`);
	else {
		console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
		failures.push(label);
	}
}

try {
	const modelRuntime = await ModelRuntime.create({
		authPath: join(agentDir, "auth.json"),
		modelsPath: null, // 不读 ~/.pi/agent/models.json
		allowModelNetwork: false,
		refreshOnCreate: false,
	});
	modelRuntime.registerNativeProvider(fauxProvider);

	const model = modelRuntime.getModel("faux", "faux-1");
	check("getModel(faux/faux-1) 命中", !!model);

	const { session } = await createAgentSession({
		cwd: tempDir,
		agentDir,
		model,
		modelRuntime,
		sessionManager: SessionManager.inMemory(),
		customTools: [echoTool],
		tools: ["echo"], // allowlist 语义：只开 echo，关掉内建 read/bash/edit/write
	});

	const events = [];
	const deltas = [];
	session.subscribe((event) => {
		events.push(event);
		if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
			deltas.push(event.assistantMessageEvent.delta);
		}
	});

	try {
		await session.prompt("Please call the echo tool.");
	} finally {
		// 事件时间线（证据用）
		const timeline = events.map((e) =>
			e.type === "message_update" ? `message_update(${e.assistantMessageEvent.type})` : e.type,
		);
		console.log("\n事件时间线:", timeline.join(" → "));

		// 断言
		console.log("\n断言:");
		check("echo 工具被真实执行 1 次", echoExecutions === 1, `actual=${echoExecutions}`);
		check(
			"tool_execution_start/end 事件成对出现",
			events.some((e) => e.type === "tool_execution_start" && e.toolName === "echo") &&
				events.some((e) => e.type === "tool_execution_end" && e.toolName === "echo" && !e.isError),
		);
		check("streamFn 被调用 2 次（工具回合 + 收尾回合）", streamCalls.length === 2, `actual=${streamCalls.length}`);
		check("text_delta 增量拼接 === 最终文本", deltas.join("") === FINAL_TEXT, `got "${deltas.join("")}"`);

		const roles = session.state.messages.map((m) => m.role);
		console.log("messages roles:", roles.join(" → "));
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
		check("toolResult 内容为 echo:hello pi", resultText === "echo:hello pi", `got "${resultText}"`);
		const finalMsg = session.state.messages[3];
		const finalText = finalMsg?.content?.find?.((c) => c.type === "text")?.text;
		check("末条 assistant 文本正确", finalText === FINAL_TEXT, `got "${finalText}"`);

		session.dispose();
	}
} finally {
	rmSync(tempDir, { recursive: true, force: true });
	rmSync(agentDir, { recursive: true, force: true });
}

if (failures.length > 0) {
	console.error(`\nS-pi-1 离线面 FAILED: ${failures.length} 项未过`);
	process.exit(1);
}
console.log("\nS-pi-1 离线面 ALL PASS");
