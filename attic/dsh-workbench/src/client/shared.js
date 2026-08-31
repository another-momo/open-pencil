/**
 * shared.js — entry 与 editor-boot 的共享态（薄共享模块，无核心依赖，无环）。
 */

export const ASSETS_BASE = "/plugins/openpencil-marketing/assets/";

export function islandState() {
	if (!window.__openpencilIsland) {
		window.__openpencilIsland = {
			reactMounts: 0,
			vueMounts: 0,
			vueUid: null,
			domNode: null,
			canvaskit: null,
			editor: null,
			errors: [],
		};
	}
	return window.__openpencilIsland;
}
