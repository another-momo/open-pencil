/**
 * openpencil-marketing · client island（浏览器侧，dsh client runtime 加载）
 *
 * 机制（T12/X1/X5 实证）：shell.overlay 注册 React island（ctx.slots.register，additive，
 * session 切换不卸载）；React 组件内 createPortal 到 body，div 上挂载独立 Vue 3 app。
 *
 * 骨架期的真实功能：工作台壳（docked 面板）+ 7600 桥连通性状态（浏览器↔编辑器进程
 * WS ping，拓扑 B↔C 链路）。整幅 overlay 布局（画布+ChatPanel）随 T15 编辑器入岛落地。
 *
 * 挂载仪表：window.__openpencilIsland 记录 React/Vue 挂载次数、Vue uid、DOM 节点引用——
 * 开发回路（HMR 证伪）与「切 session 不卸载」回归判定用。
 *
 * 模块契约（weshop 实证）：export inject + apply(ctx) → dispose。
 */

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { createApp, h, onUnmounted, ref as vueRef } from "vue";

export const inject = ["slots", "sessions"];

const BRIDGE_URL = "ws://127.0.0.1:7600";

function islandState() {
	if (!window.__openpencilIsland) {
		window.__openpencilIsland = { reactMounts: 0, vueMounts: 0, vueUid: null, domNode: null, errors: [] };
	}
	return window.__openpencilIsland;
}

/** Vue app：工作台壳 + 7600 桥状态探针（5s 心跳，断线可手动重连） */
function mountVueApp(el) {
	const state = islandState();
	const app = createApp({
		setup() {
			const status = vueRef("连接中");
			const rtt = vueRef(null);
			let ws = null;
			let timer = null;

			const beat = () => {
				if (!ws || ws.readyState !== WebSocket.OPEN) return;
				const t0 = performance.now();
				const onMsg = (ev) => {
					try {
						const resp = JSON.parse(ev.data);
						if (resp && resp.error === undefined) {
							rtt.value = Math.round(performance.now() - t0);
							status.value = "在线";
						}
					} catch { /* 非 ping 回包，忽略 */ }
					ws?.removeEventListener("message", onMsg);
				};
				ws.addEventListener("message", onMsg);
				ws.send(JSON.stringify({ id: 1, method: "ping" }));
			};

			const connect = () => {
				status.value = "连接中";
				rtt.value = null;
				try { ws?.close(); } catch { /* 忽略 */ }
				ws = new WebSocket(BRIDGE_URL);
				ws.onopen = () => { status.value = "在线"; beat(); };
				ws.onclose = () => { status.value = "离线"; rtt.value = null; };
				ws.onerror = () => { status.value = "离线"; };
				clearInterval(timer);
				timer = setInterval(beat, 5000);
			};

			connect();
			onUnmounted(() => { clearInterval(timer); try { ws?.close(); } catch { /* 忽略 */ } });

			return () =>
				h("div", { "data-openpencil-vue": "root", style: { width: "260px", fontFamily: "sans-serif", fontSize: "13px" } }, [
					h("div", {
						"data-openpencil-vue": "header",
						style: { padding: "8px 12px", fontWeight: "600", borderBottom: "1px solid #e5e7eb" },
					}, "OpenPencil 营销工作台"),
					h("div", { style: { padding: "10px 12px", display: "flex", alignItems: "center", gap: "8px" } }, [
						h("span", {
							"data-openpencil-vue": "dot",
							style: {
								width: "8px", height: "8px", borderRadius: "50%",
								background: status.value === "在线" ? "#22c55e" : status.value === "连接中" ? "#f59e0b" : "#9ca3af",
							},
						}),
						h("span", { "data-openpencil-vue": "status" },
							`编辑器桥 ${status.value}` + (rtt.value != null ? ` · ${rtt.value}ms` : "")),
						h("button", {
							"data-openpencil-vue": "reconnect",
							style: { marginLeft: "auto", fontSize: "12px" },
							onClick: connect,
						}, "重连"),
					]),
				]);
		},
	});
	app.config.errorHandler = (err) => state.errors.push(String(err));
	app.mount(el);
	state.vueMounts++;
	state.vueUid = app._uid;
	return app;
}

function WorkbenchIsland() {
	const hostRef = useRef(null);

	useEffect(() => {
		const state = islandState();
		state.reactMounts++;
		state.domNode = hostRef.current;
		const app = mountVueApp(hostRef.current);
		return () => {
			app.unmount();
		};
	}, []);

	return createPortal(
		<div
			ref={hostRef}
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
			}}
		/>,
		document.body,
	);
}

export function apply(ctx) {
	const disposeIsland = ctx.slots.register(
		{ name: "shell.overlay", id: "openpencil-marketing-island", order: 10 },
		() => <WorkbenchIsland />,
	);
	return () => {
		disposeIsland();
	};
}
