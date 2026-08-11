import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import {
  clearVisionBaseURL,
  clearVisionKey,
  clearVisionModel,
  saveVisionSettings
} from '@/app/ai/marketing/vision-settings'

function setup(storageValues = { key: '', baseURL: '', model: '' }) {
  const storage = {
    visionAPIKey: ref(storageValues.key),
    visionBaseURL: ref(storageValues.baseURL),
    visionModel: ref(storageValues.model)
  }
  const inputs = {
    visionKeyInput: ref(''),
    visionBaseURLInput: ref(storageValues.baseURL),
    visionModelInput: ref(storageValues.model),
    hasExistingVisionKey: ref(!!storageValues.key)
  }
  return { storage, inputs }
}

describe('vision settings save/clear', () => {
  test('save persists all three fields and clears the key input only', () => {
    const { storage, inputs } = setup()
    inputs.visionKeyInput.value = 'sk-new'
    inputs.visionBaseURLInput.value = 'https://vision.example/v1'
    inputs.visionModelInput.value = 'vision-model'

    saveVisionSettings(storage, inputs)

    expect(storage.visionAPIKey.value).toBe('sk-new')
    expect(storage.visionBaseURL.value).toBe('https://vision.example/v1')
    expect(storage.visionModel.value).toBe('vision-model')
    expect(inputs.visionKeyInput.value).toBe('')
    expect(inputs.hasExistingVisionKey.value).toBe(true)
  })

  test('save with an empty key input keeps the stored key (never-echo design)', () => {
    const { storage, inputs } = setup({
      key: 'sk-stored',
      baseURL: 'https://old.example/v1',
      model: 'old-model'
    })
    // key input stays blank (as initialized); user edits only the model
    inputs.visionModelInput.value = 'new-model'

    saveVisionSettings(storage, inputs)

    expect(storage.visionAPIKey.value).toBe('sk-stored')
    expect(storage.visionModel.value).toBe('new-model')
  })

  test('save overwrites baseURL/model with empty string — clearing is legitimate', () => {
    const { storage, inputs } = setup({
      key: 'sk-stored',
      baseURL: 'https://old.example/v1',
      model: 'old-model'
    })
    inputs.visionBaseURLInput.value = ''
    inputs.visionModelInput.value = '  '

    saveVisionSettings(storage, inputs)

    expect(storage.visionBaseURL.value).toBe('')
    expect(storage.visionModel.value).toBe('')
    expect(storage.visionAPIKey.value).toBe('sk-stored')
  })

  test('each clear button clears only its own field', () => {
    const { storage, inputs } = setup({
      key: 'sk-stored',
      baseURL: 'https://old.example/v1',
      model: 'old-model'
    })

    clearVisionBaseURL(storage, inputs)
    expect(storage.visionBaseURL.value).toBe('')
    expect(inputs.visionBaseURLInput.value).toBe('')
    expect(storage.visionAPIKey.value).toBe('sk-stored')
    expect(storage.visionModel.value).toBe('old-model')

    clearVisionModel(storage, inputs)
    expect(storage.visionModel.value).toBe('')
    expect(inputs.visionModelInput.value).toBe('')
    expect(storage.visionAPIKey.value).toBe('sk-stored')

    clearVisionKey(storage, inputs)
    expect(storage.visionAPIKey.value).toBe('')
    expect(inputs.visionKeyInput.value).toBe('')
    expect(inputs.hasExistingVisionKey.value).toBe(false)
  })
})
