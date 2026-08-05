import type { Ref } from 'vue'

/**
 * Pure save/clear logic for the vision channel-B credential fields
 * (VisionKeysSection). Extracted from the provider-settings context so the
 * semantics are unit-testable without mounting components.
 *
 * Storage refs hold the persisted values (useLocalStorage in the app, plain
 * refs in tests); input refs are the dialog's edit buffers.
 */
export interface VisionSettingsStorage {
  visionApiKey: Ref<string>
  visionBaseURL: Ref<string>
  visionModel: Ref<string>
}

export interface VisionSettingsInputs {
  visionKeyInput: Ref<string>
  visionBaseURLInput: Ref<string>
  visionModelInput: Ref<string>
  hasExistingVisionKey: Ref<boolean>
}

/**
 * Persist the dialog inputs. The API key only overwrites when non-empty — the
 * key field is always initialized blank by design (never echo a stored
 * secret), so an untouched field must not wipe the stored key. baseURL/model
 * overwrite unconditionally: clearing them to '' is a legitimate
 * "unconfigure" action.
 */
export function saveVisionSettings(
  storage: VisionSettingsStorage,
  inputs: VisionSettingsInputs
): void {
  const key = inputs.visionKeyInput.value.trim()
  if (key) {
    storage.visionApiKey.value = key
    inputs.hasExistingVisionKey.value = true
    inputs.visionKeyInput.value = ''
  }
  storage.visionBaseURL.value = inputs.visionBaseURLInput.value.trim()
  storage.visionModel.value = inputs.visionModelInput.value.trim()
}

export function clearVisionKey(storage: VisionSettingsStorage, inputs: VisionSettingsInputs): void {
  storage.visionApiKey.value = ''
  inputs.visionKeyInput.value = ''
  inputs.hasExistingVisionKey.value = false
}

export function clearVisionBaseURL(
  storage: VisionSettingsStorage,
  inputs: VisionSettingsInputs
): void {
  storage.visionBaseURL.value = ''
  inputs.visionBaseURLInput.value = ''
}

export function clearVisionModel(
  storage: VisionSettingsStorage,
  inputs: VisionSettingsInputs
): void {
  storage.visionModel.value = ''
  inputs.visionModelInput.value = ''
}
