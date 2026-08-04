<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import { useProviderSettingsContext } from '@/components/settings/provider/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsField v-if="!ctx.isACP" :label="dialogs.lookImagesKept">
    <ProviderSettingsInput
      v-model.number="ctx.lookImagesKept"
      type="number"
      data-test-id="provider-settings-look-images-kept"
      :min="1"
      :max="3"
      :step="1"
    />
  </ProviderSettingsField>
</template>
