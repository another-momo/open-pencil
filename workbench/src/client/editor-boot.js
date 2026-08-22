/**
 * editor-boot.js — 编辑器启动 + Vue 岛挂载（T15/E2）。
 *
 * 本模块静态依赖 @open-pencil/core 全链（含 yoga-layout）——必须晚求值：
 * core 的 layout/yoga-helpers 在模块顶层就 `Yoga.Config.create()`（dist 实证），
 * 而 yoga wasm 只能异步编译。入口 index.jsx 因此只在 `await yogaReady` 之后
 * 用动态 import() 拉本模块（inlineDynamicImports 下子图惰性求值），保证
 * 任何 core 模块求值时 Yoga 已就绪。不要从入口静态导入本模块。
 */

import { createApp, h, onMounted, onUnmounted, ref as vueRef } from "vue";
import { getCanvasKit } from "@open-pencil/core/canvaskit";
import { fontManager } from "@open-pencil/core/text";
import { createEditor } from "@open-pencil/core/editor";
import { provideEditor, useCanvas, useCanvasInput } from "@open-pencil/vue";
import { ASSETS_BASE, islandState } from "./shared.js";

// 编辑器画布容器元素：boot 期 getViewportSize 闭包读它（mount 前回退默认尺寸），
// Vue ref 回调填充；surface onReady 时再 zoomToFit 校准一次。
let editorAreaEl = null;
const editorAreaSize = () => ({
	width: editorAreaEl?.clientWidth || 920,
	height: editorAreaEl?.clientHeight || 640,
});

// ---------------------------------------------------------------------------
// 真桥客户端（T16/B2）：同源取 token → WS register → 最小命令面在活编辑器上执行。
// 协议对齐 packages/mcp browser-rpc.ts（2026-08-22 读源码）：
//   ← {type:'register', token:null}   连接欢迎提示（token 永不内含）
//   → {type:'register', token}        我们的注册；成功后 server 广播第二轮提示（=ack）
//   ← {type:'request', id, command, args}  → {type:'response', id, ok, result|error}
// ---------------------------------------------------------------------------

function nodeSummary(n) {
	return n ? { id: n.id, type: n.type, name: n.name ?? null, x: n.x, y: n.y, width: n.width, height: n.height } : null;
}

/** 最小命令面（T16-plan §1.2-3）：直打 core editor API，不搬 figma-factory。 */
async function executeBridgeCommand(editor, command, args) {
	switch (command) {
		case "ping":
			return { pong: true, t: Date.now() };
		case "getSelection":
			return {
				selectedIds: [...editor.state.selectedIds],
				nodes: [...editor.state.selectedIds].map((id) => nodeSummary(editor.getNode(id))),
			};
		case "getDocumentTree": {
			const depth = Math.min(Number(args?.depth ?? 4), 8);
			const walk = (id, d) => {
				const out = nodeSummary(editor.getNode(id));
				if (out && d > 0) {
					const kids = editor.getChildren(id) ?? [];
					if (kids.length) out.children = kids.map((k) => walk(k.id, d - 1));
				}
				return out;
			};
			return { pages: (editor.getPages() ?? []).map((p) => walk(p.id, depth)) };
		}
		case "createShape": {
			const { shapeType, x = 0, y = 0, width = 100, height = 100 } = args ?? {};
			editor.createShape(String(shapeType), Number(x), Number(y), Number(width), Number(height));
			return { selectedIds: [...editor.state.selectedIds] };
		}
		case "setProps": {
			const { nodeId, props } = args ?? {};
			if (!nodeId || !props || typeof props !== "object") throw new Error("setProps 需要 nodeId + props 对象");
			if (!editor.getNode(nodeId)) throw new Error("node not found: " + nodeId);
			editor.updateNode(nodeId, props);
			return { node: nodeSummary(editor.getNode(nodeId)) };
		}
		default:
			throw new Error("unknown command: " + command);
	}
}

/** E2 启动序列：字体预填 → canvaskit 单例预热 → createEditor + demo scene。 */
export async function bootEditor() {
	const t0 = performance.now();
	const fontResp = await fetch(ASSETS_BASE + "Inter-Regular.ttf");
	if (!fontResp.ok) throw new Error(`Inter-Regular.ttf fetch failed: HTTP ${fontResp.status}`);
	const fontBuf = await fontResp.arrayBuffer();
	fontManager.markLoaded("Inter", "Regular", fontBuf);

	const ck = await getCanvasKit({ locateFile: (file) => ASSETS_BASE + file });

	const editor = createEditor({ getViewportSize: editorAreaSize });
	editor.createShape("FRAME", 100, 100, 400, 300);
	editor.createShape("RECTANGLE", 150, 150, 120, 80);
	editor.createShape("ELLIPSE", 350, 200, 100, 100);
	// 原始 editor 句柄（不可 JSON 序列化）：E4 交互冒烟与浏览器侧断言用
	islandState()._editor = editor;

	return {
		ck,
		editor,
		bootMs: Math.round(performance.now() - t0),
		fontBytes: fontBuf.byteLength,
	};
}

/**
 * T15/E1 探针（保留）：在 96×96 缩略画布实画红矩形 + readPixels 回读校验。
 * canvaskit 单例已在 boot 期预热，此处量的是 surface 创建+绘制+回读。
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

		const ck = await getCanvasKit();
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

		record.probeMs = Math.round(performance.now() - t0);
		record.status = record.pixelCheck ? "ok" : "error";
		if (!record.pixelCheck) record.error = "pixel readback mismatch";
		ckStatus.value = record.pixelCheck ? `在线 · ${record.probeMs}ms` : "像素校验失败";
	} catch (err) {
		record.status = "error";
		record.error = String(err?.message ?? err);
		state.errors.push("canvaskit: " + record.error);
		ckStatus.value = "初始化失败";
	}
}

/** Vue app：营销壳 header（7600 桥 + CanvasKit 状态）+ 编辑器画布主体（E2） */
export function mountVueApp(el, { ck, editor, bootMs, fontBytes }) {
	const state = islandState();
	const app = createApp({
		setup() {
			provideEditor(editor);

			const status = vueRef("连接中");
			const ckStatus = vueRef("未启动");
			// 收起只切 display 保留 canvas DOM：v-if 重建会丢 surface；展开时
			// useCanvas 的 ResizeObserver 会按新尺寸重配 surface。
			const collapsed = vueRef(false);
			let probeCanvasEl = null;
			let ws = null;
			let reconnectTimer = null;
			let intentionalClose = false;

			// 真桥客户端（T16/B2）：token 同源取，register ack = 第二轮 register 提示
			const connect = async () => {
				const state = islandState();
				let port = 7600;
				let token = null;
				status.value = "连接中";
				try {
					const resp = await fetch("/plugins/openpencil-marketing/bridge-token");
					if (!resp.ok) throw new Error("bridge-token HTTP " + resp.status);
					const info = await resp.json();
					port = info.port;
					token = info.token;
				} catch (err) {
					status.value = "离线";
					state.bridge = { registered: false, error: String(err?.message ?? err) };
					scheduleReconnect();
					return;
				}
				try { ws?.close(); } catch { /* 忽略 */ }
				const sock = new WebSocket(`ws://127.0.0.1:${port}`);
				ws = sock;
				let registerSent = false;
				sock.onmessage = async (ev) => {
					let msg;
					try { msg = JSON.parse(ev.data); } catch { return; }
					if (msg.type === "register" && msg.token === null) {
						if (!registerSent) {
							registerSent = true;
							sock.send(JSON.stringify({ type: "register", token }));
						} else {
							// 第二轮广播提示 = register 成功 ack（browser-rpc.ts registerBrowser 末尾 broadcast 实证）
							status.value = "已注册";
							state.bridge = { registered: true, registeredAt: Date.now() };
						}
						return;
					}
					if (msg.type !== "request" || !msg.id) return;
					try {
						const result = await executeBridgeCommand(editor, msg.command, msg.args);
						if (sock.readyState === WebSocket.OPEN) {
							sock.send(JSON.stringify({ type: "response", id: msg.id, ok: true, result }));
						}
					} catch (err) {
						if (sock.readyState === WebSocket.OPEN) {
							sock.send(JSON.stringify({ type: "response", id: msg.id, ok: false, error: String(err?.message ?? err) }));
						}
					}
				};
				sock.onclose = () => {
					if (intentionalClose) return;
					status.value = "离线";
					state.bridge = { registered: false };
					scheduleReconnect();
				};
				sock.onerror = () => { status.value = "离线"; };
			};

			const scheduleReconnect = () => {
				clearTimeout(reconnectTimer);
				reconnectTimer = setTimeout(() => { if (!intentionalClose) void connect(); }, 3000);
			};

			// E2 主画布：单 canvas 全层渲染（EditorCanvas 的双 canvas 分层是优化项，入岛从简）；
			// useCanvas 返回的三个 hitTest 回调直喂 useCanvasInput（EditorCanvas.vue 同款接法）。
			const canvasRef = vueRef(null);
			const { hitTestSectionTitle, hitTestComponentLabel, hitTestFrameTitle } = useCanvas(
				canvasRef,
				editor,
				{
					showRulers: false,
					onReady: () => {
						editor.zoomToFit();
						state.editor = { ready: true, bootMs, fontBytes };
					},
				},
			);
			useCanvasInput(
				canvasRef,
				editor,
				hitTestSectionTitle,
				hitTestComponentLabel,
				hitTestFrameTitle,
			);

			void connect();
			onMounted(() => {
				if (probeCanvasEl) runCanvasKitProbe(probeCanvasEl, ckStatus);
			});
			onUnmounted(() => {
				intentionalClose = true;
				clearTimeout(reconnectTimer);
				try { ws?.close(); } catch { /* 忽略 */ }
			});

			const dot = (on, busy) => h("span", {
				style: {
					width: "8px", height: "8px", borderRadius: "50%", display: "inline-block",
					background: on ? "#22c55e" : busy ? "#f59e0b" : "#9ca3af",
				},
			});

			return () =>
				h("div", {
					"data-openpencil-vue": "root",
					style: {
						width: collapsed.value ? "auto" : "min(1040px, calc(100vw - 32px))",
						height: collapsed.value ? "auto" : "min(720px, calc(100vh - 32px))",
						display: "flex", flexDirection: "column",
						fontFamily: "sans-serif", fontSize: "13px",
					},
				}, [
					h("div", {
						"data-openpencil-vue": "header",
						style: {
							padding: "6px 12px", fontWeight: "600", borderBottom: "1px solid #e5e7eb",
							display: "flex", alignItems: "center", gap: "14px", flex: "none",
						},
					}, [
						h("span", null, "OpenPencil 营销工作台"),
						h("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "400", color: "#4b5563" } }, [
							dot(status.value === "已注册", status.value === "连接中"),
							h("span", { "data-openpencil-vue": "status" }, `编辑器桥 ${status.value}`),
						]),
						h("span", { style: { display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "400", color: "#4b5563" } }, [
							dot(ckStatus.value.startsWith("在线"), ckStatus.value === "初始化中"),
							h("span", { "data-openpencil-vue": "ck-status" }, `CanvasKit ${ckStatus.value}`),
						]),
						h("button", {
							"data-openpencil-vue": "collapse",
							style: { fontSize: "12px" },
							onClick: () => { collapsed.value = !collapsed.value; },
						}, collapsed.value ? "展开" : "收起"),
						h("button", {
							"data-openpencil-vue": "reconnect",
							style: { marginLeft: collapsed.value ? "8px" : "auto", fontSize: "12px" },
							onClick: connect,
						}, "重连"),
					]),
					h("div", {
						"data-openpencil-vue": "editor-area",
						ref: (el) => { editorAreaEl = el; },
						style: {
							position: "relative", flex: "1 1 auto", minHeight: "0",
							background: "#f8fafc", display: collapsed.value ? "none" : "block",
						},
					}, [
						h("canvas", {
							"data-openpencil-vue": "editor-canvas",
							ref: canvasRef,
							style: {
								position: "absolute", inset: "0",
								width: "100%", height: "100%", display: "block",
							},
						}),
						h("canvas", {
							"data-openpencil-vue": "ck-canvas",
							ref: (el) => { probeCanvasEl = el; },
							width: 96,
							height: 96,
							style: {
								position: "absolute", right: "12px", bottom: "12px",
								border: "1px dashed #d1d5db", borderRadius: "4px",
								background: "#fff", boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
							},
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

/** 入口动态导入后的总装：boot 编辑器 → 挂 Vue 岛。返回 Vue app（dispose 用）。 */
export async function bootAndMount(el) {
	const booted = await bootEditor();
	return mountVueApp(el, booted);
}
