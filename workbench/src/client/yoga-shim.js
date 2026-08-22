/**
 * yoga-layout CJS 打包 shim（T15/E2）。
 *
 * 问题：@open-pencil/yoga-layout 的主入口 dist/src/index.js 用 top-level await
 * （`wrapAssembly(await loadYoga())`），rolldown 的 CJS 输出拒收 TLA（E2 首建实测报错）。
 * 解法：经 tsdown resolveId 插件把裸导入 "yoga-layout" 精确重定向到本文件——
 *  - 命名导出（Align/Direction/Edge 等枚举）从 "yoga-layout/load" 静态 re-export（无 TLA）；
 *  - 默认导出 Yoga 用 Proxy 顶替：模块求值时即踢起异步初始化，任何访问发生在
 *    初始化完成前都会带明确信息抛错；
 *  - bootEditor 在 createEditor 前 `await yogaReady`，保证首次布局时 Yoga 已就绪
 *    （确定性排序，不靠时序运气）。
 */

import { loadYoga } from "yoga-layout/load";

export * from "yoga-layout/load";

let real = null;

export const yogaReady = (async () => {
	real = await loadYoga();
})();

export default new Proxy(
	{},
	{
		get: (_target, key) => {
			if (!real) throw new Error("yoga-shim: Yoga accessed before yogaReady resolved");
			const value = real[key];
			return typeof value === "function" ? value.bind(real) : value;
		},
		set: (_target, key, value) => {
			if (!real) throw new Error("yoga-shim: Yoga mutated before yogaReady resolved");
			real[key] = value;
			return true;
		},
	},
);
