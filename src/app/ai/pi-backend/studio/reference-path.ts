/**
 * references path 形态校验（P2-3a）：扩展名白名单 + 禁 `..` / 绝对路径 / 盘符 / UNC。
 *
 * validate.ts（声明期拒注册）与 load-reference.ts（运行期拒读取）共用本实现——
 * 纵深防御 = 两侧各查一次，规则本体单一真源（消除两处私有拷贝的漂移面）。
 * 入参须已做反斜杠归一（`\` → `/`）；validate 侧在 parseReferences 归一后调用。
 */

/** references path 扩展名白名单（P2-3a）。 */
export const REFERENCE_EXT_ALLOWLIST: ReadonlySet<string> = new Set([
  ".md",
  ".txt",
  ".json",
  ".yaml",
  ".csv",
]);

/** reference path 形态问题（null = 合法）。 */
export function referencePathProblem(path: string): string | null {
  if (path.startsWith("/")) return "是绝对路径（UNC 同拒）";
  if (/^[A-Za-z]:/.test(path)) return "含盘符";
  if (path.split("/").some((seg) => seg === "..")) return "含 `..` 上跳";
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  if (!REFERENCE_EXT_ALLOWLIST.has(ext)) {
    return `扩展名「${ext}」不在白名单（${[...REFERENCE_EXT_ALLOWLIST].join("/")}）`;
  }
  return null;
}
