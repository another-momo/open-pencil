export type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
  /**
   * Fires when the agent side sends an `abort` envelope for this
   * request. The bridge owns the dispatch — handlers and tool
   * implementations listen on this rather than receiving the abort
   * envelope directly, so they stay agnostic of the transport.
   */
  abort: () => void
}
