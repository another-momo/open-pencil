import { VECTORIZE_CREDENTIAL_REFS } from '@/app/editor/vectorize/credentials'
import { storageCredentialRefs, storageProviderRegistry } from '@/app/integrations/storage'
import {
  PEXELS_CREDENTIAL,
  UNSPLASH_CREDENTIAL
} from '@/app/settings/credentials/media-credentials'
import { credentialKey } from '@/app/settings/credentials/reference'

import { setBrowserCredentialPersistence } from './app'
import type { CredentialRef } from './types'

/**
 * T25：旧 AI provider / 模型连接 / harness MCP 连接三类 credential ref 已随
 * 旧面切除（T25-plan D1/D2），剩余 = stock-photo + vectorize + 存储集成。
 */
function uniqueCredentialRefs(references: CredentialRef[]): CredentialRef[] {
  return [...new Map(references.map((reference) => [credentialKey(reference), reference])).values()]
}

export function appCredentialRefs(): CredentialRef[] {
  const storageCredentials = storageProviderRegistry
    .list()
    .flatMap((provider) => storageCredentialRefs(provider.id))
  return uniqueCredentialRefs([
    PEXELS_CREDENTIAL,
    UNSPLASH_CREDENTIAL,
    ...VECTORIZE_CREDENTIAL_REFS,
    ...storageCredentials
  ])
}

export function setAppCredentialPersistence(remembered: boolean): Promise<void> {
  return setBrowserCredentialPersistence(remembered, appCredentialRefs())
}
