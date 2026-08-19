import { expect, test } from 'bun:test'

import { rebuildMessages } from '@/app/i18n/fork/messages'

import { setLocale } from '#vue/i18n/locale'

test('fork i18n seam: en default resolves', () => {
  setLocale('en')
  expect(rebuildMessages.get().seamProbe).toBe('Fork i18n seam works')
})

test('fork i18n seam: zh-CN pack loads lazily', async () => {
  setLocale('zh-CN')
  // lazy pack loads asynchronously after locale switch
  await new Promise((resolve) => {
    setTimeout(resolve, 50)
  })
  expect(rebuildMessages.get().seamProbe).toBe('fork i18n 缝已接通')
  setLocale('en')
})
