import { computed, ref } from 'vue'

import { DEFAULT_COLLAB_STATE, type CollabState, type RemotePeer } from '@/app/collab/types'
import type { EditorStore } from '@/app/editor/active-store'

export { COLLAB_KEY, useCollabInjected } from '@/app/collab/context'
export { DEFAULT_COLLAB_STATE }
export type { CollabState, RemotePeer }

// Collaboration is disabled: this stub keeps the original useCollab surface so
// consumers (provide/inject, browser bridge, mobile HUD) keep working, but it
// never connects, tracks no presence, and exposes an empty state.
export function useCollab(_storeOrGetter: EditorStore | (() => EditorStore)) {
  const state = ref<CollabState>({ ...DEFAULT_COLLAB_STATE, peers: [] })
  const remotePeers = computed(() => state.value.peers)
  const followingPeer = ref<number | null>(null)

  function connect(_roomId: string) {
    /* collab removed: intentionally a no-op */
  }
  function disconnect() {
    /* collab removed: intentionally a no-op */
  }
  function shareCurrentDoc(): string {
    return ''
  }
  function updateCursor(_x: number, _y: number, _pageId: string) {
    /* collab removed: intentionally a no-op */
  }
  function updateSelection(_ids: string[]) {
    /* collab removed: intentionally a no-op */
  }
  function setLocalName(_name: string) {
    /* collab removed: intentionally a no-op */
  }
  function followPeer(clientId: number | null) {
    followingPeer.value = clientId
  }
  function tickFollow() {
    /* collab removed: intentionally a no-op */
  }

  return {
    state,
    remotePeers,
    followingPeer,
    connect,
    disconnect,
    shareCurrentDoc,
    updateCursor,
    updateSelection,
    setLocalName,
    followPeer,
    tickFollow
  }
}
