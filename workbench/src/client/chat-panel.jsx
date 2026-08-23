/**
 * ChatPanel（T17/C1-C3）：孤岛内自写 React 聊天面板，消费 dsh SessionFace。
 *
 * 通路（T17-self-check §2.1 源码实证，dsh 0.1.1-rc.1）：
 *   ctx.sessions.list (ObservableSnapshot<SessionListState>) → .current
 *   → ctx.sessions.binding(id)?.session → SessionFace
 *   = ISession 动词面（prompt/cancel/…） & ObservableSnapshot<ConversationSnapshot>
 *
 * 订阅模型：ObservableSnapshot { getSnapshot, subscribe } 与 useSyncExternalStore
 * 直接对口。shell.overlay 切 session 不卸载（X5 gate），故 list.current 变化时
 * 必须整体换绑 SessionFace 订阅——useSyncExternalStore 的 subscribe 回调依赖
 * face 身份，React 负责退旧订新。
 *
 * 渲染面（conversation.d.ts 实证）：ConversationSnapshot.nodes（seq 作 key 的
 * ConversationNode 联合）+ partial（流式增量）+ running + promptError。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useSyncExternalStore } from "react";

/** 订阅 dsh 当前会话的 SessionFace；无 current 或 binding 未就绪时返回 null。 */
export function useCurrentSessionFace(ctx) {
	const subscribeList = useCallback(
		(fn) => ctx.sessions.list.subscribe(fn),
		[ctx],
	);
	const getList = useCallback(() => ctx.sessions.list.getSnapshot(), [ctx]);
	const listState = useSyncExternalStore(subscribeList, getList);
	const current = listState?.current;
	if (!current) return null;
	return ctx.sessions.binding(current)?.session ?? null;
}

/** 订阅 SessionFace 的 ConversationSnapshot；face 为 null 时返回 null。 */
export function useConversation(face) {
	const subscribe = useCallback(
		(fn) => (face ? face.subscribe(fn) : () => {}),
		[face],
	);
	const getSnapshot = useCallback(
		() => (face ? face.getSnapshot() : null),
		[face],
	);
	return useSyncExternalStore(subscribe, getSnapshot);
}

// ---------------------------------------------------------------------------
// 渲染辅助
// ---------------------------------------------------------------------------

/** ContentBlock[] → 纯文本（text/reasoning 拼接，image/tool-call 给占位标签）。 */
function contentText(content) {
	if (!Array.isArray(content)) return "";
	return content
		.map((b) => {
			if (b?.type === "text" || b?.type === "reasoning") return b.text;
			if (b?.type === "image") return `[图片 ${b.attachment?.name ?? ""}]`;
			if (b?.type === "tool-call") return `[工具调用 ${b.name}]`;
			if (b?.type === "tool-result") return "[工具结果]";
			return `[${b?.type ?? "unknown"}]`;
		})
		.join("");
}

const S = {
	userBubble: {
		background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px",
		padding: "6px 10px", margin: "6px 0 6px 32px", whiteSpace: "pre-wrap", wordBreak: "break-word",
	},
	assistantBlock: { margin: "6px 0", whiteSpace: "pre-wrap", wordBreak: "break-word" },
	reasoning: {
		background: "#f3f4f6", borderRadius: "6px", padding: "4px 8px",
		color: "#6b7280", fontSize: "12px", margin: "4px 0",
	},
	toolCard: {
		background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "6px",
		padding: "4px 8px", margin: "4px 0", fontSize: "12px",
	},
	mono: { fontFamily: "monospace", fontSize: "11px", whiteSpace: "pre-wrap", wordBreak: "break-all", color: "#475569" },
	notice: { color: "#6b7280", fontSize: "12px", margin: "4px 0", textAlign: "center" },
	errorRow: {
		background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "6px",
		padding: "4px 8px", margin: "4px 0", color: "#b91c1c", fontSize: "12px",
	},
	meta: { color: "#9ca3af", fontSize: "11px", marginTop: "2px" },
};

function AssistantBlocks({ blocks }) {
	if (!Array.isArray(blocks)) return null;
	return blocks.map((b, i) => {
		switch (b?.kind) {
			case "text":
				return <div key={i} style={S.assistantBlock}>{b.text}</div>;
			case "reasoning":
				return (
					<details key={i} style={S.reasoning}>
						<summary>Think</summary>
						<div style={{ whiteSpace: "pre-wrap" }}>{b.text}</div>
					</details>
				);
			case "tool-call":
				return (
					<div key={i} style={S.toolCard}>
						<div>⚙ {b.name}</div>
						<div style={S.mono}>{b.argsRaw}</div>
					</div>
				);
			case "image":
				return <div key={i} style={S.assistantBlock}>[图片 {b.attachment?.name ?? ""}]</div>;
			default:
				return <div key={i} style={S.mono}>{JSON.stringify(b?.block ?? b)}</div>;
		}
	});
}

function NodeView({ node }) {
	switch (node.kind) {
		case "user":
			return <div style={S.userBubble} data-openpencil-chat-node="user">{contentText(node.content)}</div>;
		case "steering":
			return (
				<div style={{ ...S.userBubble, borderStyle: "dashed" }} data-openpencil-chat-node="steering">
					<span style={S.meta}>[steering] </span>{contentText(node.content)}
				</div>
			);
		case "assistant":
			return (
				<div data-openpencil-chat-node="assistant">
					<AssistantBlocks blocks={node.blocks} />
					{node.interrupted && <div style={S.meta}>已停止</div>}
					{node.provenance && (
						<div style={S.meta}>{node.provenance.provider}/{node.provenance.model}</div>
					)}
				</div>
			);
		case "context":
			return (
				<details style={S.notice} data-openpencil-chat-node="context">
					<summary>上下文注入{node.provenance?.producer ? ` · ${node.provenance.producer}` : ""}</summary>
					<div style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>{contentText(node.content)}</div>
				</details>
			);
		case "model-retry":
			return (
				<div style={S.notice} data-openpencil-chat-node="model-retry">
					模型重试（{node.retryState}）{node.message ?? ""}
				</div>
			);
		case "turn-error":
			return (
				<div style={S.errorRow} data-openpencil-chat-node="turn-error">
					本轮运行失败：{node.message}{node.code ? ` [${node.code}]` : ""}
				</div>
			);
		case "turn-max-tokens":
			return <div style={S.notice} data-openpencil-chat-node="turn-max-tokens">输出达到 token 上限</div>;
		case "tool-result":
			return (
				<div style={node.isError ? { ...S.toolCard, ...S.errorRow } : S.toolCard} data-openpencil-chat-node="tool-result">
					<div>
						{node.isError ? "✕" : "✓"} {node.call?.name ?? `callId ${node.callId}`}
						{node.error ? ` [${node.error.code}]` : ""}
						{node.subCalls?.length ? `（子调用 ${node.subCalls.length}）` : ""}
					</div>
					<div style={S.mono}>{contentText(node.content).slice(0, 2000)}</div>
				</div>
			);
		case "command":
			return (
				<div style={S.notice} data-openpencil-chat-node="command">
					命令 /{node.name ?? "?"}{node.args ?? ""} {node.outcome ? `→ ${node.outcome.kind}` : "（执行中）"}
				</div>
			);
		case "compaction":
			return (
				<details style={S.notice} data-openpencil-chat-node="compaction">
					<summary>
						上下文压缩{node.shadowedItemCount != null ? `（替换 ${node.shadowedItemCount} 项）` : ""}
					</summary>
					{node.summary && <div style={{ textAlign: "left", whiteSpace: "pre-wrap" }}>{node.summary}</div>}
				</details>
			);
		default:
			return (
				<div style={S.mono} data-openpencil-chat-node="unknown">
					[{node.kind ?? node.type ?? "unknown"}] {JSON.stringify(node.data ?? node).slice(0, 500)}
				</div>
			);
	}
}

// ---------------------------------------------------------------------------
// ChatPanel 主体
// ---------------------------------------------------------------------------

export function ChatPanel({ ctx }) {
	const face = useCurrentSessionFace(ctx);
	const conv = useConversation(face);
	const [error, setError] = useState(null);
	const [draft, setDraft] = useState("");
	const bodyRef = useRef(null);

	const nodeCount = conv?.nodes?.length ?? 0;
	const partial = conv?.partial ?? null;
	const running = conv?.running ?? false;

	// 新内容/流式增量时滚到底
	useEffect(() => {
		const el = bodyRef.current;
		if (el) el.scrollTop = el.scrollHeight;
	}, [nodeCount, partial]);

	const send = async () => {
		const text = draft.trim();
		if (!face || !text) return;
		setDraft("");
		const result = await face.prompt([{ type: "text", text }], running ? "steer" : "queue");
		if (!result?.ok) setError(JSON.stringify(result?.error ?? result));
		else setError(null);
	};

	const cancel = async () => {
		if (!face) return;
		const result = await face.cancel();
		if (!result?.ok) setError(JSON.stringify(result?.error ?? result));
	};

	const sessionId = face?.sessionId ?? null;
	const shortId = sessionId ? sessionId.replace(/^session-/, "").slice(0, 8) : null;

	return (
		<div
			data-openpencil-chat="root"
			style={{
				width: "380px",
				height: "min(720px, calc(100vh - 32px))",
				display: "flex",
				flexDirection: "column",
				borderLeft: "1px solid #e5e7eb",
				fontFamily: "sans-serif",
				fontSize: "13px",
				background: "#fff",
			}}
		>
			<div
				data-openpencil-chat="header"
				style={{
					padding: "6px 12px", fontWeight: 600, borderBottom: "1px solid #e5e7eb",
					flex: "none", display: "flex", alignItems: "center", gap: "8px",
				}}
			>
				<span>ChatPanel · {shortId ?? "无当前会话"}</span>
				{running && <span data-openpencil-chat="running" style={{ color: "#2563eb", fontWeight: 400 }}>● 运行中</span>}
				{running && (
					<button
						data-openpencil-chat="cancel"
						style={{ fontSize: "12px", fontWeight: 400 }}
						onClick={() => void cancel()}
					>
						停止
					</button>
				)}
				{conv?.removed && <span style={{ color: "#b91c1c", fontWeight: 400 }}>会话已移除</span>}
			</div>
			<div ref={bodyRef} data-openpencil-chat="body" style={{ flex: "1 1 auto", overflow: "auto", padding: "8px 12px" }}>
				{!face && <div style={{ color: "#6b7280" }}>未绑定会话（dsh 无 current 或 binding 未就绪）</div>}
				{face && conv?.openState === "loading" && <div style={S.notice}>会话加载中…</div>}
				{face && conv?.openState === "error" && (
					<div style={S.errorRow}>会话打开失败：{String(conv.openError?.message ?? conv.openError)}</div>
				)}
				{face && conv?.hasMore && (
					<div style={S.notice} data-openpencil-chat="has-more">（上方还有更早的消息）</div>
				)}
				{(conv?.nodes ?? []).map((n) => <NodeView key={n.seq} node={n} />)}
				{partial && (
					<div data-openpencil-chat="partial" style={{ opacity: 0.85 }}>
						<AssistantBlocks blocks={partial.blocks} />
						<span style={{ color: "#2563eb" }}>▍</span>
					</div>
				)}
				{face && (conv?.nodes?.length ?? 0) === 0 && !partial && conv?.openState === "open" && (
					<div style={{ color: "#6b7280" }}>空会话——发一条消息开始。</div>
				)}
			</div>
			<div data-openpencil-chat="composer" style={{ flex: "none", borderTop: "1px solid #e5e7eb", padding: "8px" }}>
				{error && <div data-openpencil-chat="error" style={{ ...S.errorRow }}>{error}</div>}
				{conv?.promptError && (
					<div data-openpencil-chat="prompt-error" style={{ ...S.errorRow }}>
						{String(conv.promptError?.message ?? conv.promptError)}
					</div>
				)}
				<textarea
					data-openpencil-chat="input"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							void send();
						}
					}}
					rows={2}
					style={{ width: "100%", resize: "none", boxSizing: "border-box" }}
					placeholder={face ? (running ? "运行中——Enter 以 steer 插入" : "给当前会话发消息（Enter 发送）") : "等待会话绑定"}
					disabled={!face || !!conv?.removed}
				/>
			</div>
		</div>
	);
}
