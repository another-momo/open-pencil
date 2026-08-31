import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PLUGIN_ID = "openpencil-marketing";
const here = path.dirname(fileURLToPath(import.meta.url));

// vue 与 canvaskit-wasm 必须全图单例：@open-pencil/vue（file: 链接，真实路径在
// packages/vue）会把它们解析到仓根 node_modules，与本包 node_modules 是两份
// 实体——双 vue 拷贝 = 两套 reactivity，直接坏。alias 强制收敛到本包拷贝。
//
// E2 四跑实证：光钉 "vue" 不够——@vue/* 全家桶会按 importer 位置（.bun store /
// 本包）× 格式（CJS require 臂 / ESM import 臂）裂成四套拷贝，vueuse 的
// watch/computed 与本岛 app 各属一套 reactivity，跨套不追踪（ref 变更不触发
// 重评估）——症状：渲染正常但 useEventListener 全部不挂（实测零监听）。
// 解法：@vue/* 逐个钉到本包 node_modules 的 esm-bundler 构建（单一实体）。
const req = createRequire(import.meta.url);
const VUE_ESM = (pkg, file) => req.resolve(`${pkg}/dist/${file}`);
const clientAlias = {
	vue: req.resolve("vue/dist/vue.runtime.esm-bundler.js"),
	"@vue/shared": VUE_ESM("@vue/shared", "shared.esm-bundler.js"),
	"@vue/reactivity": VUE_ESM("@vue/reactivity", "reactivity.esm-bundler.js"),
	"@vue/runtime-core": VUE_ESM("@vue/runtime-core", "runtime-core.esm-bundler.js"),
	"@vue/runtime-dom": VUE_ESM("@vue/runtime-dom", "runtime-dom.esm-bundler.js"),
	"@vue/compiler-core": VUE_ESM("@vue/compiler-core", "compiler-core.esm-bundler.js"),
	"@vue/compiler-dom": VUE_ESM("@vue/compiler-dom", "compiler-dom.esm-bundler.js"),
	"canvaskit-wasm": req.resolve("canvaskit-wasm"),
};

// yoga-layout 主入口含 top-level await，CJS 输出拒收——把裸导入精确重定向到
// src/client/yoga-shim.js（Proxy 顶默认导出 + yogaReady 启动门闩）。
// 用 resolveId 插件而非 resolve.alias：alias 对 "yoga-layout/load" 这类深路径
// 有前缀匹配语义，会把 shim 自身的 /load 导入也改写炸掉。
//
// css-tree（unifont 的传递依赖）：主入口是 CJS lib/，其 data 模块 eval 期即跑
// createRequire 装 mdn-data——浏览器岛必炸（E2 三跑实测）。重定向到官方
// dist/csstree.esm.js（数据内联的自包含 ESM 构建，功能无损）。
const unifontEntry = req.resolve("unifont", { paths: [path.join(here, "../../packages/core")] });
const cssTreeRoot = path.dirname(createRequire(unifontEntry).resolve("css-tree/package.json"));
const cssTreeEsm = path.join(cssTreeRoot, "dist/csstree.esm.js");

const exactRedirectPlugin = {
	name: "openpencil-exact-redirect",
	resolveId(id) {
		if (id === "yoga-layout") return path.join(here, "src/client/yoga-shim.js");
		if (id === "css-tree") return cssTreeEsm;
		return null;
	},
};

// node 内建模块桩（E2）——双层：
//  1. nodeStubPlugin（构建期）：dep 图里 ESM 风格的 node 内建 import 会被 rolldown
//     提升为顶层 require(...) 或做命名导入静态绑定，导入必须能解析——重定向到虚拟桩模块。
//  2. intro 的 require  polyfill（运行期）：CJS dep 函数体内残留的字面量 require
//     （css-tree 惰性初始化、yoga-wasm-base64-esm 的 Emscripten loader 无条件
//     `require("url").pathToFileURL(__filename)` —— E2 二跑实测在模块求值期即炸）
//     不过构建期解析——intro 在 factory 内罩一层：node 内建词先回桩对象，
//     其余（react / react/jsx-runtime）转发 dsh ModuleLoader 原 require。
// 这些桩全部是 dep 的非浏览器臂：浏览器岛正常路径永不执行，真被调到才带名抛错。
const NODE_STUB_BARE = new Set([
	"module", "buffer", "crypto", "fs", "http", "https", "net",
	"path", "stream", "url", "util", "zlib", "os", "process", "events",
	"worker_threads", "stream/web",
]);
const NODE_STUB_SOURCE = `
const unavailable = (name) => () => {
	throw new Error("[openpencil island] node builtin stubbed (browser path must not reach): " + name);
};
class Buffer extends Uint8Array {
	static from(value, encoding) {
		if (typeof value === "string") {
			if (encoding === "base64") {
				const bin = atob(value);
				const u8 = new Uint8Array(bin.length);
				for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
				return new Buffer(u8);
			}
			return new Buffer(new TextEncoder().encode(value));
		}
		return new Buffer(value);
	}
	static isBuffer(x) { return x instanceof Buffer; }
	static concat(list) {
		let n = 0; for (const c of list) n += c.length;
		const out = new Buffer(n); let o = 0;
		for (const c of list) { out.set(c, o); o += c.length; }
		return out;
	}
}
export function createRequire() { return unavailable("createRequire()"); }
export { Buffer };
export const randomUUID = () => globalThis.crypto.randomUUID();
export const createHash = unavailable("crypto.createHash");
export const createReadStream = unavailable("fs.createReadStream");
export const statSync = unavailable("fs.statSync");
export const promises = new Proxy({}, { get: (_t, k) => unavailable("fs.promises." + String(k)) });
export const PassThrough = unavailable("stream.PassThrough");
export const pipeline = unavailable("stream.pipeline");
export const isIP = () => 0;
export const createServer = unavailable("http(s).createServer");
export const get = unavailable("http(s).get");
export const request = unavailable("http(s).request");
export const Agent = unavailable("http(s).Agent");
export const createGzip = unavailable("zlib.createGzip");
export const gzipSync = unavailable("zlib.gzipSync");
export const gunzipSync = unavailable("zlib.gunzipSync");
export const deflateSync = unavailable("zlib.deflateSync");
export const inflateSync = unavailable("zlib.inflateSync");
export const deprecate = (fn) => fn;
export const promisify = () => unavailable("util.promisify");
export const types = {};
export const inspect = (v) => String(v);
export const format = unavailable("url.format");
export const pathToFileURL = (p) => new URL("file://" + String(p).replaceAll("\\\\\\\\", "/"));
export const fileURLToPath = unavailable("url.fileURLToPath");
const join = (...parts) => parts.filter(Boolean).join("/").replaceAll(/\\/+/g, "/");
export const basename = (p) => String(p).split(/[\\\\/]/).pop();
export const dirname = (p) => { const s = String(p).replaceAll(/[\\\\/]+$/, ""); const i = s.search(/[^\\\\/]+$/); return i > 0 ? s.slice(0, i - 1) : "."; };
export const extname = (p) => { const b = basename(p); const i = b.lastIndexOf("."); return i > 0 ? b.slice(i) : ""; };
export const resolve = (...parts) => join(...parts);
export { join };
export const sep = "/";
export const platform = "browser";
export const nextTick = (fn, ...args) => queueMicrotask(() => fn(...args));
export const EventEmitter = class { on() { return this; } emit() { return false; } once() { return this; } off() { return this; } };
const fallback = new Proxy(unavailable("default"), { get: (_t, k) => unavailable("node builtin default." + String(k)) });
export default { createRequire, Buffer, randomUUID, createHash, createReadStream, statSync, promises, PassThrough, pipeline, isIP, createServer, get, request, Agent, createGzip, gzipSync, gunzipSync, deflateSync, inflateSync, deprecate, promisify, types, inspect, format, pathToFileURL, fileURLToPath, join, basename, dirname, extname, resolve, sep, platform, nextTick, EventEmitter, fallback };
`;
const nodeStubPlugin = {
	name: "openpencil-node-stub",
	resolveId(id) {
		const bare = id.replace(/^node:/, "");
		if (NODE_STUB_BARE.has(bare)) return "\0openpencil-node-stub";
		return null;
	},
	load(id) {
		if (id === "\0openpencil-node-stub") return NODE_STUB_SOURCE;
		return null;
	},
};

const nodeConfig = {
	name: `${PLUGIN_ID}/node`,
	entry: { index: "src/index.js" },
	outDir: "lib",
	format: "esm",
	platform: "node",
	target: "es2022",
	deps: { alwaysBundle: ["ws"] },
	clean: false,
	dts: false,
	sourcemap: false,
	outputOptions: { entryFileNames: "index.js" },
};

const CLIENT_INTRO = `
var module = { exports: {} }; var exports = module.exports;
var __filename = "/openpencil-island-client.js"; var __dirname = "/";
var __dshRequire = require;
var __nodeStub = (function () {
	var unavailable = function (name) { return function () { throw new Error("[openpencil island] node builtin stubbed (browser path must not reach): " + name); }; };
	var urlStub = {
		pathToFileURL: function (p) { return new URL("file://" + String(p).replace(/\\\\/g, "/")); },
		format: unavailable("url.format"),
		fileURLToPath: unavailable("url.fileURLToPath")
	};
	return {
		module: { createRequire: function () { return unavailable("createRequire()"); } },
		url: urlStub,
		worker_threads: {},
		"stream/web": {},
		fs: { createReadStream: unavailable("fs.createReadStream"), statSync: unavailable("fs.statSync"), promises: {} },
		path: { basename: function (p) { return String(p).split(/[\\\\/]/).pop(); }, sep: "/" },
		crypto: { createHash: unavailable("crypto.createHash"), randomUUID: function () { return globalThis.crypto.randomUUID(); } },
		buffer: {},
		http: {}, https: {}, net: { isIP: function () { return 0; } }, zlib: {}, stream: {}, os: {}, process: {}, events: {}
	};
})();
var require = function (id) {
	var bare = String(id).replace(/^node:/, "");
	if (Object.prototype.hasOwnProperty.call(__nodeStub, bare)) return __nodeStub[bare];
	return __dshRequire(id);
};`;

// dsh client runtime 经 __ModuleLoader__ 加载浏览器侧模块：CJS 包壳 +
// banner/footer 注册。react 由宿主提供（external），不得打进产物。
const clientConfig = {
	name: `${PLUGIN_ID}/client`,
	entry: { client: "src/client/index.jsx" },
	outDir: "lib",
	format: "cjs",
	platform: "browser",
	target: "es2022",
	clean: false,
	dts: false,
	sourcemap: true,
	external: ["react", "react/jsx-runtime"],
	noExternal: () => true,
	// tsdown 的 alias 是顶层字段（types 实证）；resolve.conditionNames 走 inputOptions
	// 透传——clientConfig 里写 resolve 键会被 tsdown 静默丢弃（E2 四跑实证：
	// resolve:{alias} 完全没生效，vue 裂四套、ohash 走了 node 臂）。
	alias: clientAlias,
	inputOptions: (opts) => {
		opts.resolve = {
			...(opts.resolve ?? {}),
			// 浏览器 bundle 不走 node 条件（ohash/crypto 有 node/js 双臂，钉 js 臂）
			conditionNames: ["browser", "module", "import", "default"],
		};
		return opts;
	},
	plugins: [exactRedirectPlugin, nodeStubPlugin],
	define: { "process.env.NODE_ENV": JSON.stringify("production") },
	outputOptions: {
		entryFileNames: "client.js",
		// 宿主只供 /plugins/<id>/client.js 单文件——动态 import 必须内联，
		// 否则拆出的 chunk（node:* 守卫分支、locale 等）运行时 404。
		inlineDynamicImports: true,
		banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(PLUGIN_ID)}, factory: (require) => {`,
		footer: "return module.exports; } });",
		intro: CLIENT_INTRO,
	},
};

export default [nodeConfig, clientConfig];
