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
 */

import { useCallback, useState } from "react";
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

/** C1 最小面板：绑定证据（sessionId/消息数/running/末条摘要）。C2 全型渲染替换主体。 */
export function ChatPanel({ ctx }) {
	const face = useCurrentSessionFace(ctx);
	const conv = useConversation(face);
	const [error, setError] = useState(null);
	const [draft, setDraft] = useState("");

	const send = async () => {
		const text = draft.trim();
		if (!face || !text) return;
		setDraft("");
		const result = await face.prompt([{ type: "text", text }], "queue");
		if (!result?.ok) setError(JSON.stringify(result?.error ?? result));
		else setError(null);
	};

	const sessionId = face?.sessionId ?? null;
	const nodes = conv?.nodes ?? [];
	const running = conv?.running ?? false;
	const lastText = [...nodes].reverse().find((n) => n.kind === "user" || n.kind === "assistant");

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
				style={{ padding: "6px 12px", fontWeight: 600, borderBottom: "1px solid #e5e7eb", flex: "none" }}
			>
				ChatPanel · {sessionId ? `会话 ${sessionId}` : "无当前会话"}
				{running ? "（运行中）" : ""}
			</div>
			<div data-openpencil-chat="body" style={{ flex: "1 1 auto", overflow: "auto", padding: "8px 12px" }}>
				{!face && <div style={{ color: "#6b7280" }}>未绑定会话（dsh 无 current 或 binding 未就绪）</div>}
				{face && (
					<>
						<div data-openpencil-chat="count">消息节点 {nodes.length} 条</div>
						{lastText && (
							<div data-openpencil-chat="last" style={{ marginTop: "8px", color: "#374151" }}>
								末条 [{lastText.kind}] seq={lastText.seq}
							</div>
						)}
						{conv?.partial && <div data-openpencil-chat="partial">流式中（turn {conv.partial.turn}）</div>}
					</>
				)}
			</div>
			<div data-openpencil-chat="composer" style={{ flex: "none", borderTop: "1px solid #e5e7eb", padding: "8px" }}>
				{error && <div data-openpencil-chat="error" style={{ color: "#dc2626", marginBottom: "6px" }}>{error}</div>}
				{conv?.promptError && (
					<div data-openpencil-chat="prompt-error" style={{ color: "#dc2626", marginBottom: "6px" }}>
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
					placeholder={face ? "给当前会话发消息（Enter 发送）" : "等待会话绑定"}
					disabled={!face}
				/>
			</div>
		</div>
	);
}
