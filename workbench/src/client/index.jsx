/**
 * openpencil-marketing · client island（浏览器侧，dsh client runtime 加载）
 *
 * 机制（T12/X1/X5 实证）：shell.overlay 注册 React island（ctx.slots.register，additive，
 * session 切换不卸载）；React 组件内 createPortal 到 body，div 上挂载独立 Vue 3 app。
 *
 * 骨架期的真实功能：工作台壳（docked 面板）+ 7600 桥连通性状态（浏览器↔编辑器进程
 * WS ping，拓扑 B↔C 链路）+ CanvasKit wasm 初始化探针（T15/E1：wasm 经宿主资产路由
 * 加载，MakeCanvasSurface 画红矩形并 readPixels 回读校验——全路线最大风险项的第一刀）。
 *
 * 挂载仪表：window.__openpencilIsland 记录 React/Vue 挂载次数、Vue uid、DOM 节点引用、
 * CanvasKit 探针实测值——开发回路（HMR 证伪）、「切 session 不卸载」回归判定与
 * T15/E1 验收取证共用。
 *
 * 模块契约（weshop 实证）：export inject + apply(ctx) → dispose。
 */

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { createApp, h, onMounted, onUnmounted, ref as vueRef } from "vue";
import CanvasKitInit from "canvaskit-wasm";

export const inject = ["slots", "sessions"];

const BRIDGE_URL = "ws://127.0.0.1:7600";
const ASSETS_BASE = "/plugins/openpencil-marketing/assets/";

function islandState() {
	if (!window.__openpencilIsland) {
		window.__openpencilIsland = { reactMounts: 0, vueMounts: 0, vueUid: null, domNode: null, canvaskit: null, errors: [] };
	}
	return window.__openpencilIsland;
}

/**
 * T15/E1 探针：CanvasKit 在 island 内初始化 + 实画 + 像素回读。
 * locateFile 指向宿主侧资产路由（对齐 packages/core/src/canvaskit.ts 的 locateFile 机制）；
 * 结果写入 window.__openpencilIsland.canvaskit 供自动化取证。
 */
async function runCanvasKitProbe(canvasEl, ckStatus) {
	const state = islandState();
	const record = { status: "init", runs: (state.canvaskit?.runs ?? 0) + 1 };
	state.canvaskit = record;
	ckStatus.value = "初始化中";
	const t0 = performance.now();
	try {
		const head = await fetch(ASSETS_BASE + "canvaskit.wasm", { method: "HEAD" });
		record.wasmHttpStatus = head.status;
		record.wasmBytes = Number(head.headers.get("content-length") ?? 0);

		const ck = await CanvasKitInit({ locateFile: (file) => ASSETS_BASE + file });
		record.initMs = Math.round(performance.now() - t0);

		const surface = ck.MakeCanvasSurface(canvasEl);
		if (!surface) throw new Error("MakeCanvasSurface returned null");
		const canvas = surface.getCanvas();
		canvas.clear(ck.Color4f(0, 0, 0, 0));
		const paint = new ck.Paint();
		paint.setColor(ck.Color4f(1, 0, 0, 1));
		canvas.drawRect(ck.LTRBRect(8, 8, 88, 88), paint);
		surface.flush();

		const image = surface.makeImageSnapshot();
		const pixels = image.readPixels(0, 0, {
			width: 96,
			height: 96,
			colorType: ck.ColorType.RGBA_8888,
			alphaType: ck.AlphaType.Unpremul,
			colorSpace: ck.ColorSpace.SRGB,
		});
		if (!pixels) throw new Error("readPixels returned null");
		const at = (x, y) => Array.from(pixels.slice((y * 96 + x) * 4, (y * 96 + x) * 4 + 4));
		record.insidePixel = at(48, 48);
		record.outsidePixel = at(2, 2);
		record.pixelCheck =
			record.insidePixel.join() === "255,0,0,255" && record.outsidePixel.join() === "0,0,0,0";
		image.delete();
		paint.delete();
		// surface 不 delete：红矩形要留在画布上作截图证据；island 存活期一份（X5 不卸载）。

		record.status = record.pixelCheck ? "ok" : "error";
		if (!record.pixelCheck) record.error = "pixel readback mismatch";
		ckStatus.value = record.pixelCheck ? `在线 · ${record.initMs}ms` : "像素校验失败";
	} catch (err) {
		record.status = "error";
		record.error = String(err?.message ?? err);
		record.initMs = Math.round(performance.now() - t0);
		state.errors.push("canvaskit: " + record.error);
		ckStatus.value = "初始化失败";
	}
}

/** Vue app：工作台壳 + 7600 桥状态探针（5s 心跳，断线可手动重连）+ CanvasKit 探针（E1） */
function mountVueApp(el) {
	const state = islandState();
	const app = createApp({
		setup() {
			const status = vueRef("连接中");
			const rtt = vueRef(null);
			const ckStatus = vueRef("未启动");
			let canvasEl = null;
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
			onMounted(() => {
				if (canvasEl) runCanvasKitProbe(canvasEl, ckStatus);
			});
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
					h("div", { style: { padding: "0 12px 10px", borderTop: "1px solid #f3f4f6" } }, [
						h("div", { style: { padding: "10px 0 6px", display: "flex", alignItems: "center", gap: "8px" } }, [
							h("span", {
								"data-openpencil-vue": "ck-dot",
								style: {
									width: "8px", height: "8px", borderRadius: "50%",
									background: ckStatus.value.startsWith("在线") ? "#22c55e" : ckStatus.value === "初始化中" ? "#f59e0b" : ckStatus.value === "未启动" ? "#9ca3af" : "#ef4444",
								},
							}),
							h("span", { "data-openpencil-vue": "ck-status" }, `CanvasKit ${ckStatus.value}`),
						]),
						h("canvas", {
							"data-openpencil-vue": "ck-canvas",
							ref: (el) => { canvasEl = el; },
							width: 96,
							height: 96,
							style: { border: "1px dashed #d1d5db", borderRadius: "4px" },
						}),
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
