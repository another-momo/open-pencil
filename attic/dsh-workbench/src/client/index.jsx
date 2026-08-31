/**
 * openpencil-marketing · client island 入口（浏览器侧，dsh client runtime 加载）
 *
 * 机制（T12/X1/X5 实证）：shell.overlay 注册 React island（ctx.slots.register，additive，
 * session 切换不卸载）；React 组件内 createPortal 到 body，div 上挂载独立 Vue 3 app。
 * T17 起 portal 为 flex 行容器：左 Vue 编辑器面板（自带收起），右 React ChatPanel
 * （消费 ctx.sessions 的 SessionFace，chat-panel.jsx）。
 *
 * 本入口刻意保持薄（T15/E2 硬约束）：core 引擎链（含 yoga-layout）的模块在顶层
 * 就触 Yoga（layout/yoga-helpers `Yoga.Config.create()`，dist 实证），而 yoga wasm
 * 只能异步编译——故入口只静态引 yoga-shim（eval 时踢起 wasm 编译）与共享态，
 * `await yogaReady` 之后才动态 import("./editor-boot.js")（inlineDynamicImports
 * 下子图惰性求值），保证 core 任何模块求值时 Yoga 已就绪。
 *
 * 模块契约（weshop 实证）：export inject + apply(ctx) → dispose。
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { yogaReady } from "./yoga-shim.js";
import { islandState } from "./shared.js";
import { ChatPanel } from "./chat-panel.jsx";

export const inject = ["slots", "sessions"];

function WorkbenchIsland({ ctx }) {
	const hostRef = useRef(null);

	useEffect(() => {
		const state = islandState();
		state.reactMounts++;
		state.domNode = hostRef.current;
		let app = null;
		let cancelled = false;
		(async () => {
			try {
				await yogaReady;
				const { bootAndMount } = await import("./editor-boot.js");
				if (cancelled) return;
				app = bootAndMount ? await bootAndMount(hostRef.current) : null;
			} catch (err) {
				state.errors.push("boot: " + String(err?.message ?? err));
				state.editor = { ready: false, error: String(err?.message ?? err) };
			}
		})();
		return () => {
			cancelled = true;
			app?.unmount();
		};
	}, []);

	return createPortal(
		<div
			data-openpencil-island="react-host"
			style={{
				position: "fixed",
				right: "16px",
				bottom: "16px",
				zIndex: 1000001,
				background: "#fff",
				border: "1px solid #d1d5db",
				borderRadius: "8px",
				boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
				pointerEvents: "auto",
				display: "flex",
				flexDirection: "row",
				alignItems: "flex-start",
			}}
		>
			<div ref={hostRef} data-openpencil-island="vue-host" />
			<ChatPanel ctx={ctx} />
		</div>,
		document.body,
	);
}

export function apply(ctx) {
	const disposeIsland = ctx.slots.register(
		{ name: "shell.overlay", id: "openpencil-marketing-island", order: 10 },
		() => <WorkbenchIsland ctx={ctx} />,
	);
	return () => {
		disposeIsland();
	};
}
