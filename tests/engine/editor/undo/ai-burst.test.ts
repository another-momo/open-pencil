import { describe, test, expect } from 'bun:test'

import { createUndoManager, undoEntry } from '#tests/helpers/undo'

function burstKey(burstId: number) {
  return `ai-burst-${burstId}`
}

function snapshotEntry(
  label: string,
  coalesceKey: string,
  restoreTo: number,
  state: { value: number }
) {
  return {
    label,
    coalesceKey,
    forward: () => {
      state.value = restoreTo
    },
    inverse: () => {
      state.value = -restoreTo
    }
  }
}

function makeStepEntry(
  i: number,
  coalesceKey: string,
  tracker: { state: number; restored: number[] }
) {
  return {
    label: `AI: op${i}`,
    coalesceKey,
    forward: () => {
      tracker.state = i
    },
    inverse: () => {
      tracker.state = i - 1
      tracker.restored.push(i - 1)
    }
  }
}

describe('AI burst undo coalesce', () => {
  test('N consecutive pushes with the same burstId merge into one entry', () => {
    const undo = createUndoManager()
    const state = { value: 0 }
    for (let i = 1; i <= 5; i++) {
      undo.push(snapshotEntry(`AI: op${i}`, burstKey(0), i, state))
    }
    expect(undo.undoLabel).toBe('AI: op5')
    undo.undo()
    expect(undo.canUndo).toBe(false)
  })

  test('merged entry keeps the oldest inverse and the newest forward', () => {
    const undo = createUndoManager()
    const tracker = { state: 0, restored: [] as number[] }
    for (let i = 1; i <= 5; i++) {
      undo.push(makeStepEntry(i, burstKey(0), tracker))
    }
    undo.undo()
    expect(tracker.state).toBe(0)
    expect(tracker.restored).toEqual([0])
    undo.redo()
    expect(tracker.state).toBe(5)
  })

  test('intermediate snapshots become unreachable after merge', async () => {
    const undo = createUndoManager()
    let intermediate: { data: number[] } | null = {
      data: Array.from({ length: 1000 }, () => 1)
    }
    const ref = new WeakRef(intermediate)

    undo.push({
      label: 'AI: op1',
      coalesceKey: burstKey(0),
      forward: () => void intermediate,
      inverse: () => undefined
    })
    intermediate = null
    undo.push({
      label: 'AI: op2',
      coalesceKey: burstKey(0),
      forward: () => undefined,
      inverse: () => undefined
    })

    Bun.gc(true)
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0)
    })
    Bun.gc(true)
    expect(ref.deref()).toBeUndefined()
  })

  test('user entries without coalesceKey break the merge chain', () => {
    const undo = createUndoManager()
    const state = { value: 0 }
    undo.push(snapshotEntry('AI: op1', burstKey(0), 1, state))
    undo.push(undoEntry('Move'))
    undo.push(snapshotEntry('AI: op2', burstKey(0), 2, state))

    expect(undo.undoLabel).toBe('AI: op2')
    undo.undo()
    expect(undo.undoLabel).toBe('Move')
    undo.undo()
    expect(undo.undoLabel).toBe('AI: op1')
    undo.undo()
    expect(undo.canUndo).toBe(false)
  })

  test('different burstIds do not merge', () => {
    const undo = createUndoManager()
    const state = { value: 0 }
    undo.push(snapshotEntry('AI: op1', burstKey(1), 1, state))
    undo.push(snapshotEntry('AI: op2', burstKey(1), 2, state))
    undo.push(snapshotEntry('AI: op3', burstKey(2), 3, state))

    expect(undo.undoLabel).toBe('AI: op3')
    undo.undo()
    expect(undo.undoLabel).toBe('AI: op2')
    undo.undo()
    expect(undo.canUndo).toBe(false)
  })
})
