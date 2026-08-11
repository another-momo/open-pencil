<script setup lang="ts">
import { useI18n } from '@open-pencil/vue'

import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import { useProviderSettingsContext } from '@/components/settings/provider/context'

const ctx = useProviderSettingsContext()
const { dialogs } = useI18n()
</script>

<template>
  <ProviderSettingsKeyField
    v-model="ctx.imageGenKeyInput"
    :label="dialogs.imageGenAPIKey"
    :saved="!!ctx.imageGenApiKey"
    kind="image-gen"
    :placeholder="
      ctx.hasExistingImageGenKey ? dialogs.keySavedReplace : dialogs.imageGenAPIKeyPlaceholder
    "
    key-u-r-l="https://doc.dmxapi.cn/gpt-image-2-text-to-image.html"
    :key-u-r-l-label="dialogs.imageGenAPIDocs"
    @clear="ctx.clearImageGenKey"
    @change="ctx.save"
  />

  <ProviderSettingsKeyField
    v-model="ctx.imageGenBaseURLInput"
    :label="dialogs.imageGenBaseURL"
    :saved="!!ctx.imageGenBaseURL"
    kind="url"
    type="text"
    placeholder="https://www.dmxapi.cn/v1"
    @clear="ctx.clearImageGenKey"
    @change="ctx.save"
  />

  <ProviderSettingsKeyField
    v-model="ctx.imageGenModelInput"
    :label="dialogs.imageGenModel"
    :saved="!!ctx.imageGenModel"
    kind="model"
    type="text"
    placeholder="gpt-image-2-ssvip"
    @clear="ctx.clearImageGenKey"
    @change="ctx.save"
  />
</template>
