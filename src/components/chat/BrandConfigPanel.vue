<script setup lang="ts">
/**
 * BrandConfigPanel — in-place UI for editing the user's brand config.
 *
 * Mounted as a dialog from MarketingConfigBar's "品牌库" entry. Reads
 * the effective config from the agent backend's `/v1/brand/manifest`,
 * mutations go through PUT/DELETE/POST on `/v1/brand/*`. Local refresh after
 * every mutation; no optimistic UI.
 *
 * Tabs:
 *   - Material types (id, label, size, description, source badge)
 *   - Profiles      (id, label, applicable_to chips, markdown editor)
 *   - Import / Export (download merged YAML / upload a brand file)
 *   - Danger zone   (reset to defaults with a confirm)
 */

import { computed, onMounted, ref, watch } from 'vue'

import type {
  EffectiveBrandConfig,
  EffectiveBrandProfile,
  EffectiveBrandType
} from '@open-pencil/agent/brand'
import { resolveAgentBackendURL } from '@/app/ai/chat/agent-transport'
import { setBrandConfig } from '@/app/ai/marketing/library'

const emit = defineEmits<{ close: [] }>()

type Tab = 'types' | 'profiles' | 'io' | 'danger'
const activeTab = ref<Tab>('types')
const config = ref<EffectiveBrandConfig | null>(null)
const error = ref('')
const loading = ref(false)
const editingType = ref<EffectiveBrandType | null>(null)
const editingProfile = ref<EffectiveBrandProfile | null>(null)
const importingYaml = ref('')
const importError = ref('')

const baseUrl = computed(() => resolveAgentBackendURL() ?? 'http://127.0.0.1:7601')

async function refresh() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`${baseUrl.value}/v1/brand/manifest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    config.value = (await res.json()) as EffectiveBrandConfig
    // Keep the chat-side brand cache in sync so the MarketingConfigBar chips
    // and the next-turn system-prompt overlay reflect mutations immediately.
    setBrandConfig(config.value)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
}

onMounted(refresh)
watch(activeTab, () => {
  error.value = ''
})

async function api(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`${baseUrl.value}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : res.text()
}

async function saveType() {
  if (!editingType.value) return
  try {
    await api(`/v1/brand/types/${encodeURIComponent(editingType.value.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: editingType.value.id,
        label: editingType.value.label,
        size: editingType.value.size,
        description: editingType.value.description ?? ''
      })
    })
    editingType.value = null
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function deleteType(id: string) {
  try {
    await api(`/v1/brand/types/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function newType() {
  const id = window.prompt('New type id (lowercase alphanumeric / underscore):')
  if (!id) return
  editingType.value = {
    id,
    label: id,
    size: '1080x1080',
    layer: 'user'
  }
}

async function saveProfile() {
  if (!editingProfile.value) return
  try {
    await api(`/v1/brand/profiles/${encodeURIComponent(editingProfile.value.id)}`, {
      method: 'PUT',
      body: JSON.stringify({
        id: editingProfile.value.id,
        label: editingProfile.value.label,
        applicable_to: editingProfile.value.applicable_to,
        markdown: editingProfile.value.markdown
      })
    })
    editingProfile.value = null
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function deleteProfile(id: string) {
  try {
    await api(`/v1/brand/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' })
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function newProfile() {
  const id = window.prompt('New profile id:')
  if (!id) return
  editingProfile.value = {
    id,
    label: id,
    applicable_to: [],
    markdown: '# New profile\n',
    layer: 'user'
  }
}

async function downloadExport() {
  try {
    const yaml = (await api('/v1/brand/export')) as string
    const blob = new Blob([yaml], { type: 'application/yaml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'brand-config.yaml'
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

async function runImport() {
  importError.value = ''
  try {
    await api('/v1/brand/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/yaml' },
      body: importingYaml.value
    })
    importingYaml.value = ''
    await refresh()
  } catch (e) {
    importError.value = e instanceof Error ? e.message : String(e)
  }
}

async function reset() {
  if (!window.confirm('清空所有用户自定义的 type / profile，恢复出厂预设。继续？')) return
  try {
    await api('/v1/brand/reset', { method: 'POST' })
    await refresh()
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  }
}

const tabs: { id: Tab; label: string }[] = [
  { id: 'types', label: '素材类型' },
  { id: 'profiles', label: '风格档案' },
  { id: 'io', label: '导入 / 导出' },
  { id: 'danger', label: '恢复默认' }
]
</script>

<template>
  <div class="brand-panel">
    <header class="brand-panel__head">
      <h2>品牌库</h2>
      <button class="brand-panel__close" @click="emit('close')">×</button>
    </header>

    <nav class="brand-panel__tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['brand-panel__tab', { 'is-active': activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>

    <p v-if="error" class="brand-panel__error">{{ error }}</p>
    <p v-else-if="loading">加载中…</p>

    <section v-if="activeTab === 'types' && config" class="brand-panel__section">
      <table class="brand-panel__table">
        <thead>
          <tr>
            <th>id</th>
            <th>label</th>
            <th>size</th>
            <th>description</th>
            <th>source</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="entry in config.types" :key="entry.id">
            <td>
              <code>{{ entry.id }}</code>
            </td>
            <td>{{ entry.label }}</td>
            <td>{{ entry.size }}</td>
            <td>{{ entry.description ?? '—' }}</td>
            <td>
              <span :class="['brand-panel__badge', `brand-panel__badge--${entry.layer}`]">
                {{ entry.layer === 'user' ? '已修改' : 'Default' }}
              </span>
            </td>
            <td>
              <button @click="editingType = { ...entry }">编辑</button>
              <button v-if="entry.layer === 'user'" @click="deleteType(entry.id)">删除</button>
            </td>
          </tr>
        </tbody>
      </table>
      <button class="brand-panel__primary" @click="newType">+ 新建 type</button>
    </section>

    <section v-if="activeTab === 'profiles' && config" class="brand-panel__section">
      <ul class="brand-panel__list">
        <li v-for="entry in config.profiles" :key="entry.id" class="brand-panel__list-item">
          <header>
            <strong>{{ entry.label }}</strong>
            <code>{{ entry.id }}</code>
            <span :class="['brand-panel__badge', `brand-panel__badge--${entry.layer}`]">
              {{ entry.layer === 'user' ? '已修改' : 'Default' }}
            </span>
          </header>
          <p class="brand-panel__applicable">
            适用类型:
            {{ entry.applicable_to.length === 0 ? '（全部）' : entry.applicable_to.join(', ') }}
          </p>
          <pre class="brand-panel__markdown">{{ entry.markdown }}</pre>
          <footer>
            <button @click="editingProfile = { ...entry, applicable_to: [...entry.applicable_to] }">
              编辑
            </button>
            <button v-if="entry.layer === 'user'" @click="deleteProfile(entry.id)">删除</button>
          </footer>
        </li>
      </ul>
      <button class="brand-panel__primary" @click="newProfile">+ 新建 profile</button>
    </section>

    <section v-if="activeTab === 'io'" class="brand-panel__section">
      <button class="brand-panel__primary" @click="downloadExport">下载合并视图 (YAML)</button>
      <h3>导入 YAML</h3>
      <textarea
        v-model="importingYaml"
        rows="10"
        placeholder="schema_version: 1&#10;name: ...&#10;types:&#10;  - id: ...&#10;profiles: ..."
      />
      <p v-if="importError" class="brand-panel__error">{{ importError }}</p>
      <button class="brand-panel__primary" :disabled="!importingYaml" @click="runImport">
        导入（整库替换）
      </button>
    </section>

    <section v-if="activeTab === 'danger'" class="brand-panel__section">
      <p class="brand-panel__warn">
        恢复出厂会清空所有用户自定义的 type /
        profile，默认预设不会受影响。建议先导出当前配置再恢复。
      </p>
      <button class="brand-panel__danger" @click="reset">恢复出厂设置</button>
    </section>

    <!-- Edit dialogs (inline panels) -->
    <div v-if="editingType" class="brand-panel__edit">
      <h3>编辑 type</h3>
      <label>
        label
        <input v-model="editingType.label" />
      </label>
      <label>
        size
        <input v-model="editingType.size" placeholder="1080x1080 或 750x" />
      </label>
      <label>
        description
        <textarea v-model="editingType.description" rows="3" />
      </label>
      <footer>
        <button @click="editingType = null">取消</button>
        <button class="brand-panel__primary" @click="saveType">保存</button>
      </footer>
    </div>

    <div v-if="editingProfile" class="brand-panel__edit">
      <h3>编辑 profile</h3>
      <label>
        label
        <input v-model="editingProfile.label" />
      </label>
      <label>
        applicable_to (逗号分隔，空 = 全部)
        <input
          :value="editingProfile.applicable_to.join(', ')"
          @input="
            editingProfile.applicable_to = ($event.target as HTMLInputElement).value
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          "
        />
      </label>
      <label>
        markdown
        <textarea v-model="editingProfile.markdown" rows="10" />
      </label>
      <footer>
        <button @click="editingProfile = null">取消</button>
        <button class="brand-panel__primary" @click="saveProfile">保存</button>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.brand-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  width: min(720px, 100vw);
  max-height: 80vh;
  overflow-y: auto;
}
.brand-panel__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.brand-panel__close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
}
.brand-panel__tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.brand-panel__tab {
  padding: 6px 12px;
  background: none;
  border: none;
  cursor: pointer;
  border-bottom: 2px solid transparent;
}
.brand-panel__tab.is-active {
  border-bottom-color: currentColor;
}
.brand-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.brand-panel__table th,
.brand-panel__table td {
  text-align: left;
  padding: 4px 6px;
  border-bottom: 1px solid var(--border, #e5e7eb);
}
.brand-panel__badge {
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: #f3f4f6;
}
.brand-panel__badge--user {
  background: #fef3c7;
}
.brand-panel__list {
  list-style: none;
  padding: 0;
  margin: 0;
}
.brand-panel__list-item {
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 6px;
  padding: 10px;
  margin-bottom: 8px;
}
.brand-panel__list-item header {
  display: flex;
  gap: 8px;
  align-items: center;
}
.brand-panel__applicable {
  font-size: 12px;
  color: var(--muted, #6b7280);
  margin: 4px 0;
}
.brand-panel__markdown {
  background: var(--bg, #f9fafb);
  padding: 8px;
  border-radius: 4px;
  font-size: 12px;
  white-space: pre-wrap;
  max-height: 100px;
  overflow-y: auto;
}
.brand-panel__primary {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid currentColor;
  background: none;
  cursor: pointer;
}
.brand-panel__danger {
  padding: 8px 14px;
  border-radius: 4px;
  border: 1px solid #ef4444;
  color: #ef4444;
  background: none;
  cursor: pointer;
}
.brand-panel__warn {
  color: #b45309;
}
.brand-panel__error {
  color: #b91c1c;
  font-size: 13px;
}
.brand-panel__edit {
  border: 1px dashed var(--border, #e5e7eb);
  border-radius: 6px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.brand-panel__edit label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}
.brand-panel__edit input,
.brand-panel__edit textarea {
  font-family: inherit;
  font-size: 13px;
  padding: 4px 6px;
  border: 1px solid var(--border, #e5e7eb);
  border-radius: 4px;
}
.brand-panel__edit footer {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
