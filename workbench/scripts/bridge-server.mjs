/**
 * bridge-server.mjs — T16/B1：真 7600 桥 launcher（standalone 复用 packages/mcp server）。
 *
 * B1 探针（probe-bridge-b1.mjs，8/8 PASS，2026-08-22）实证 packages/mcp server
 * 脱离旧编辑器进程独立可用：register/auth/relay 三角色协议 + discovery 文件 +
 * timingSafeEqual 鉴权。本脚本将其接入 workbench dev 回路，顶替 S-X spike 桩。
 *
 * token 链第一跳：server 启动后写 discovery 文件（默认 %LOCALAPPDATA%\OpenPencil\mcp.json，
 * 可用 OPENPENCIL_MCP_DISCOVERY_PATH 覆盖）——host 插件 node 侧从该文件读 token（B3），
 * island 浏览器侧经插件 web route 同源取（B2）。token 永不打印到日志。
 *
 * 运行：node workbench/scripts/bridge-server.mjs   （仓库根目录下；Ctrl+C 优雅关闭）
 */

import { startServer } from "../../packages/mcp/dist/server.mjs";
import { getDiscoveryPath } from "../../packages/mcp/dist/transport.mjs";
import { readDiscoveryFile } from "../../packages/mcp/dist/discovery.mjs";

const PORT = Number(process.env.OPENPENCIL_BRIDGE_PORT ?? 7600);

const server = await startServer({
	httpPort: PORT,
	withTcp: true,
	// Windows 无 unix socket；socketPath null 显式走纯 TCP（packages/mcp paths.ts 注释）
	socketPath: null,
	// 缺省自动生成 32-hex token；OPENPENCIL_MCP_AUTH_TOKEN 可显式指定（空串=关鉴权，禁用于 dev 外）
	authToken: process.env.OPENPENCIL_MCP_AUTH_TOKEN || undefined,
});

const discoveryPath = await getDiscoveryPath();
const info = await readDiscoveryFile();
console.log(
	`[bridge] 7600 真桥已起服: port=${server.httpPort} discovery=${discoveryPath} ` +
	`pid=${info?.pid ?? "?"} authRequired=${info?.authRequired ?? "?"}（token 不打印，见 discovery 文件）`,
);

const shutdown = async () => {
	await server.close();
	process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
