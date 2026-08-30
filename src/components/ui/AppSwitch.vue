<script lang="ts">
import type { ComponentUI } from '@/components/ui/types'
import type { SwitchTheme } from '@/theme/switch'

export type AppSwitchUI = ComponentUI<SwitchTheme>

export interface AppSwitchProps {
  label: string
  size?: keyof SwitchTheme['variants']['size']
  state?: keyof SwitchTheme['variants']['state']
  ui?: AppSwitchUI
  /** T41：禁用态透传（字体白名单 bundled 锁定族开关置灰） */
  disabled?: boolean
}
</script>

<script setup lang="ts">
import { computed } from 'vue'
import { SwitchRoot, SwitchThumb } from 'reka-ui'
import { tv } from 'tailwind-variants'

import theme from '@/theme/switch'

const { label, size = 'sm', state = 'idle', ui, disabled } = defineProps<AppSwitchProps>()
const modelValue = defineModel<boolean>({ required: true })
const styles = computed(() => tv(theme)({ size, state }))
</script>

<template>
  <SwitchRoot
    v-model="modelValue"
    :aria-label="label"
    :disabled="disabled"
    :data-mixed="state === 'mixed' || undefined"
    :class="styles.root({ class: ui?.root })"
  >
    <SwitchThumb :class="styles.thumb({ class: ui?.thumb })" />
  </SwitchRoot>
</template>
