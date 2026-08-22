/**
 * openpencil-spike-plugin · client island（浏览器侧，dsh client runtime 加载）
 *
 * S-X-1 / S-X-5 被测物：
 *  - shell.overlay 注册 React island（ctx.slots.register，additive）；
 *  - React 组件内 createPortal 到 body，div 上挂载独立 Vue 3 app（双框架同岛）；
 *  - 挂载仪表：window.__spikeIsland 记录 React/Vue 挂载次数、Vue uid、DOM 节点引用——
 *    X5 硬 gate 判定用（切 5 次 session 后这些计数必须仍为 1、DOM 节点同一）。
 *
 * 模块契约（weshop 实证）：export inject + apply(ctx) → dispose。
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createApp, h, ref as vueRef } from "vue";

export const inject = ["slots", "sessions"];

function spikeIslandState() {
	if (!window.__spikeIsland) {
		window.__spikeIsland = { reactMounts: 0, vueMounts: 0, vueUid: null, domNode: null, errors: [] };
	}
	return window.__spikeIsland;
}

/** Vue app：最小画布占位（计数器 + 输入框，验证 Vue 响应式在岛内存活） */
function mountVueApp(el) {
	const state = spikeIslandState();
	const app = createApp({
		setup() {
			const count = vueRef(0);
			const text = vueRef("");
			return () =>
				h("div", { "data-spike-vue": "root", style: { padding: "12px", fontFamily: "sans-serif" } }, [
					h("div", { "data-spike-vue": "title" }, "OpenPencil spike island (Vue)"),
					h("button", {
						"data-spike-vue": "inc",
						onClick: () => count.value++,
					}, `count=${count.value}`),
					h("input", {
						"data-spike-vue": "input",
						value: text.value,
						onInput: (e) => (text.value = e.target.value),
						placeholder: "vue reactivity probe",
					}),
					h("span", { "data-spike-vue": "echo" }, text.value),
				]);
		},
	});
	app.config.errorHandler = (err) => state.errors.push(String(err));
	app.mount(el);
	state.vueMounts++;
	state.vueUid = app._uid;
	return app;
}

function SpikeIsland() {
	const hostRef = useRef(null);
	const [vueApp, setVueApp] = useState(null);

	useEffect(() => {
		const state = spikeIslandState();
		state.reactMounts++;
		state.domNode = hostRef.current;
		const app = mountVueApp(hostRef.current);
		setVueApp(app);
		return () => {
			app.unmount();
		};
	}, []);

	return createPortal(
		<div
			ref={hostRef}
			data-spike-island="react-host"
			style={{
				position: "fixed",
				right: "16px",
				bottom: "16px",
				zIndex: 1000001,
				background: "#fff",
				border: "2px solid #4a6cf7",
				borderRadius: "8px",
				pointerEvents: "auto",
			}}
		/>,
		document.body,
	);
}

export function apply(ctx) {
	const disposeIsland = ctx.slots.register(
		{ name: "shell.overlay", id: "openpencil-spike-island", order: 10 },
		() => <SpikeIsland />,
	);
	return () => {
		disposeIsland();
	};
}
