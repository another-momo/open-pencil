/**
 * 删空守卫（A 方案）——把「删空」一击收编为结构事件，不让浏览器看到空编辑器。
 *
 * 根因（详见 docs/202609112147-chat-input-seg-root-detached-review.md）：
 *   ux6 完全非受控 contenteditable 下，shadowText 是 plain `let` 不响应式；
 *   结构事件通过 commitStructuralChange('') 整段换 :key 重挂 seg-root。Blink
 *   在「删空后再删一下」时会把 seg-root 整个 div 从编辑器里吃掉——Vue 对
 *   此毫无感知；下一次结构事件 patch 时，已游离的旧 seg-root.el 算插入
 *   容器得 null → insertBefore 崩溃。Blink 唯一会吃 seg-root 的扳机是
 *   「空编辑器规范化」，所以让编辑器永不为空即免疫。
 *
 * 不变量（已沉淀到 PiChatInput.vue 注释）：
 *   - 「删空一击 / 空文档删除键 / 覆盖全文删除」= 结构事件，preventDefault
 *     阻断浏览器执行，改为 commitStructuralChange('') 走 Vue 整段重挂。
 *   - 已空文档上的任何删除键 = no-op，只 preventDefault，不再触发无意义
 *     重挂。
 *
 * 纯函数面：零 DOM 依赖，node 测试环境可直接加载。text 是 shadowText（token
 * chip 以 `「@画布选区-N」` 字面在内），区间覆盖全文即覆盖 chip——chip 是
 * 原子节点，单区间若要覆盖 chip 必须整个字面段都进 [delStart, delEnd)，
 * 与字符区间语义一致，无需单独考虑 chip。
 */

export function deletionEmptiesDocument(text: string, delStart: number, delEnd: number): boolean {
  return text.length === 0 || (delStart <= 0 && delEnd >= text.length)
}
