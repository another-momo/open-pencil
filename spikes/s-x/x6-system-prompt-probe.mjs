/**
 * S-X-6 离线探针：systemPrompt.section 注入营销选择项生效（装配层面）。
 *
 * 对应 spikes/04 §7.1 第 6 项。无 API key 环境下的诚实拆分：
 *   - 本探针覆盖「切换 type 字段后，下一次 prompt 装配的文本正确响应变化」——
 *     用真实 cordis Context + 真实 @deepseek-ai/dsh-system-prompt 服务装配，
 *     加载真实 openpencil-spike-plugin（src/index.js 的 apply），通过调用真实
 *     注册的 openpencil_set_marketing_type 工具的 execute 来翻转 store。
 *     整条链路上只有 'tools' 服务是桩（与 X6 无关的子系统，仅记录注册）。
 *   - 不覆盖「模型下一次回复正确响应变化」（需要 LLM，阻塞，已上报）。
 *
 * 运行：node x6-system-prompt-probe.mjs
 * 依赖解析：cwd 需在 host-sandbox（@deepseek-ai/cordis、dsh-system-prompt 在其
 * node_modules）；插件源码里的 "ws" import 由 plugin/node_modules 解析。
 */

import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(path.join(here, "host-sandbox", "node_modules", "@deepseek-ai", "dsh", "lib", "bin.js"));

// preset 安装落沙箱（已存在则 no-op，保持探针幂等）
process.env.DSH_HOME = path.join(here, "host-sandbox", "dsh-home");

// 与 X6 无关的 tools 子系统用最小桩：cordis Service 形态（provide 语义），
// 只记录注册，供探针回调真实 execute
const { Context, Service } = require("@deepseek-ai/cordis");
class ToolsStub extends Service {
	constructor(ctx) {
		super(ctx, "tools");
		this.registered = new Map();
	}
	register(tool) {
		this.registered.set(tool.name, tool);
	}
}

const { SystemPrompt, renderPrompt } = require("@deepseek-ai/dsh-system-prompt");
const plugin = await import("./plugin/src/index.js");

const results = [];
let failures = 0;
function check(name, ok, detail) {
	results.push({ name, ok, detail });
	if (!ok) failures++;
	console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

async function assembleText(ctx) {
	const assembly = await ctx.systemPrompt.assemble({});
	return renderPrompt(assembly);
}

async function main() {
	const ctx = new Context();
	await ctx.plugin(SystemPrompt, {});
	const toolsStub = new ToolsStub(ctx);
	// 直接调插件 apply（与 cordis 插件机制等价的同步形态：inject 声明的两个
	// 服务都已就位，effect/section/register 全部走真实实现）
	await plugin.apply(ctx);
	const registeredTools = toolsStub.registered;

	const t0 = await assembleText(ctx);
	check("1. 初始装配不含 marketing section（type 未选择 → 空文本 → 整节丢弃）", !/marketing deliverable/i.test(t0), `prompt ${t0.length} chars`);

	const setter = registeredTools.get("openpencil_set_marketing_type");
	check("2. openpencil_set_marketing_type 工具已注册", !!setter, [...registeredTools.keys()].join(","));
	check("3. openpencil_apply_design 工具已注册", registeredTools.has("openpencil_apply_design"), "");

	await setter.execute({ type: "poster" });
	const t1 = await assembleText(ctx);
	check("4. 切 type=poster 后装配含 poster", /type: poster/.test(t1), "");
	check("5. 切换后 prompt 变长（section 真实进入装配）", t1.length > t0.length, `${t0.length} -> ${t1.length}`);

	await setter.execute({ type: "banner" });
	const t2 = await assembleText(ctx);
	check("6. 再切 type=banner 后装配含 banner 且不含 poster", /type: banner/.test(t2) && !/type: poster/.test(t2), "");

	await setter.execute({ type: "" });
	const t3 = await assembleText(ctx);
	check("7. 清空 type 后 marketing section 再次整节丢弃", !/marketing deliverable/i.test(t3), "");

	// 断言 4 的反向证据：section 函数确实每次装配重新求值（同一注册、三次结果不同）
	check("8. 同一 section 注册在三次装配产生三种渲染（函数逐次求值）", t0 !== t1 && t1 !== t2 && t2 !== t3, "");

	const summary = {
		item: "X6 systemPrompt.section marketing injection takes effect at assembly",
		date: new Date().toISOString().slice(0, 10),
		mechanism: "ctx.systemPrompt.section({ text: () => fn() }) — function re-evaluated per assemble(); openpencil_set_marketing_type flips the store",
		coverage: "assembly-level (real cordis + real dsh-system-prompt + real plugin apply); model-reply face blocked on API keys",
		promptLengths: [t0.length, t1.length, t2.length, t3.length],
		results,
		failures,
		verdict: failures === 0 ? "PASS" : "FAIL",
	};
	fs.writeFileSync(path.join(here, "evidence", "x6-system-prompt-result.json"), JSON.stringify(summary, null, 2));
	console.log(`\n=== X6 ${summary.verdict}（failures=${failures}）→ evidence/x6-system-prompt-result.json`);
	process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
	console.error("probe error:", err);
	process.exit(2);
});
