/**
 * S-X-5 硬 gate 自动化驱动（已按真实 dsh UI 校准）：shell.overlay 切 session 不卸载。
 *
 * 前置：dsh web 已起（127.0.0.1:3080）、openpencil-spike-plugin 已装（island 在页面上）。
 * 流程：
 *   1. 经 HTTP RPC（/api/<method>，client-request 信封）幂等准备：ws-alpha 工作区 +
 *      两个非 blank 会话（spike-x5-a / spike-x5-b）——非 blank 才会进侧边栏树。
 *   2. Playwright 开页，关掉内测声明 / API key 对话框，展开侧边栏。
 *   3. 交替点击两个 treeitem 共 5 次，每步读 window.__spikeIsland 计数器并抓
 *      document.title 证明切换真实发生。
 *   4. 通过标准（spikes/04 §7.1 第 5 项）：reactMounts === 1、vueMounts === 1、
 *      vueUid 不变、domNode 引用同一；收尾再点一次 Vue 计数器证明岛仍可交互。
 * 证据：写 evidence/x5-gate-result.json（覆盖式，含每次切换的快照行）。
 *
 * 用法：node x5-gate-test.mjs [baseUrl]   （默认 http://127.0.0.1:3080）
 * 依赖：playwright（spike 根 package.json devDependency）。
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.argv[2] ?? "http://127.0.0.1:3080";
const WORKSPACE_DIR = path.join(here, "host-sandbox", "ws-alpha");
const TITLE_A = "spike-x5-a";
const TITLE_B = "spike-x5-b";

const failures = [];
const check = (label, cond, detail) => {
	console.log(`  ${cond ? "PASS" : "FAIL"} ${label}${!cond && detail ? ` — ${detail}` : ""}`);
	if (!cond) failures.push(label);
};

async function rpc(method, payload) {
	const res = await fetch(`${baseUrl}/api/${method}`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ type: "client-request", rpcId: crypto.randomUUID(), method, payload }),
	});
	const body = await res.json();
	if (!body.result?.ok) throw new Error(`${method} failed: ${JSON.stringify(body).slice(0, 200)}`);
	return body.result.value;
}

// --- 1. RPC 幂等准备 -------------------------------------------------------

fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
const workspaces = await rpc("workspace.list", {});
let workspace = workspaces.items.find((w) => w.title === "ws-alpha");
if (!workspace) {
	workspace = (await rpc("workspace.create", { path: WORKSPACE_DIR })).workspace;
	console.log(`  setup: workspace created ${workspace.workspaceId}`);
} else {
	console.log(`  setup: workspace reused ${workspace.workspaceId}`);
}

const sessions = await rpc("session.list", {});
const mine = sessions.items.filter((s) => s.cwd && path.resolve(s.cwd) === path.resolve(WORKSPACE_DIR));
let sessA = mine.find((s) => s.projections?.values?.title === TITLE_A);
let sessB = mine.find((s) => s.projections?.values?.title === TITLE_B);
if (!sessA) {
	sessA = await rpc("session.create", { workspaceId: workspace.workspaceId });
	await rpc("session.prompt", { sessionId: sessA.sessionId, mode: "queue", content: [{ type: "text", text: "x5 probe a" }], clientTimeZone: "Asia/Shanghai" });
	await rpc("session.rename", { sessionId: sessA.sessionId, title: TITLE_A });
	console.log(`  setup: session A ${sessA.sessionId}`);
}
if (!sessB) {
	sessB = await rpc("session.create", { workspaceId: workspace.workspaceId });
	await rpc("session.prompt", { sessionId: sessB.sessionId, mode: "queue", content: [{ type: "text", text: "x5 probe b" }], clientTimeZone: "Asia/Shanghai" });
	await rpc("session.rename", { sessionId: sessB.sessionId, title: TITLE_B });
	console.log(`  setup: session B ${sessB.sessionId}`);
}
await new Promise((r) => setTimeout(r, 1500)); // 等 prompt 事件落盘、blank 翻 false

// --- 2. 浏览器驱动 ---------------------------------------------------------

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const consoleErrors = [];
page.on("console", (msg) => {
	if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push(String(err)));

await page.goto(baseUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
await page.waitForTimeout(5000);
for (const label of ["继续", "稍后配置"]) {
	const btn = page.getByRole("button", { name: label });
	if (await btn.count()) await btn.click({ timeout: 3000 }).catch(() => {});
}
const openSidebar = page.getByRole("button", { name: "打开侧边栏" });
if (await openSidebar.count()) await openSidebar.click({ timeout: 3000 }).catch(() => {});
await page.waitForTimeout(1200);

const readState = () =>
	page.evaluate(() => {
		const si = window.__spikeIsland;
		if (!si) return null;
		if (!window.__x5GateNode) window.__x5GateNode = si.domNode;
		return {
			title: document.title,
			reactMounts: si.reactMounts,
			vueMounts: si.vueMounts,
			vueUid: si.vueUid,
			sameNode: si.domNode === window.__x5GateNode,
			hostCount: document.querySelectorAll("[data-spike-island='react-host']").length,
			vueRootCount: document.querySelectorAll("[data-spike-vue='root']").length,
			islandErrors: si.errors.length,
		};
	});

const switchLog = [];
const start = await readState();
check("X5 挂载仪表已暴露且初始 1/1", !!start && start.reactMounts === 1 && start.vueMounts === 1, JSON.stringify(start));
if (start) switchLog.push({ step: "start", ...start });

const seq = [TITLE_A, TITLE_B, TITLE_A, TITLE_B, TITLE_A];
for (let i = 0; i < seq.length; i++) {
	const row = page.getByRole("treeitem", { name: seq[i] }).first();
	if ((await row.count()) === 0) {
		check(`X5 treeitem ${seq[i]} 可见`, false, "sidebar 未列出（blank 会话？）");
		break;
	}
	await row.click();
	await page.waitForTimeout(1300);
	const s = await readState();
	switchLog.push({ step: `switch#${i + 1} -> ${seq[i]}`, ...s });
	check(
		`X5 第 ${i + 1} 次切换（${seq[i]}）岛未重建`,
		!!s && s.reactMounts === 1 && s.vueMounts === 1 && s.vueUid === start.vueUid && s.sameNode === true && s.hostCount === 1 && s.vueRootCount === 1,
		JSON.stringify(s),
	);
	check(`X5 第 ${i + 1} 次切换 title 证实换会话`, !!s && s.title.startsWith(seq[i]), s?.title);
}

// 切换后岛仍可交互（验收细则：编辑画布可访问的 spike 形态——Vue 实例活着且响应）
const beforeClick = await page.locator("[data-spike-vue='inc']").innerText();
await page.locator("[data-spike-vue='inc']").click();
const afterClick = await page.locator("[data-spike-vue='inc']").innerText();
check("X5 切换后岛仍可交互（count 递增）", beforeClick !== afterClick, `${beforeClick} → ${afterClick}`);

const realErrors = consoleErrors.filter((e) => !/favicon|net::|Failed to load resource/i.test(e));
check("全程 console 无 error", realErrors.length === 0, realErrors.slice(0, 3).join(" | "));

await browser.close();

const evidence = {
	item: "X5 hard gate: shell.overlay session switch does NOT unmount island",
	date: new Date().toISOString().slice(0, 10),
	baseUrl,
	sessions: { a: sessA?.sessionId, b: sessB?.sessionId },
	switchLog,
	consoleErrors: realErrors,
	verdict: failures.length === 0 ? "PASS" : "FAIL",
};
fs.writeFileSync(path.join(here, "evidence", "x5-gate-result.json"), JSON.stringify(evidence, null, 2));
console.log(`\n=== X5 gate ${evidence.verdict}（failures=${failures.length}）→ evidence/x5-gate-result.json`);
process.exit(failures.length ? 1 : 0);
