/** Bun runtime type declarations for tsgo (which doesn't know bun:sqlite). */

declare module 'bun:sqlite' {
  interface DatabaseOptions {
    create?: boolean
    readonly?: boolean
  }

  interface RunResult {
    changes: number
  }

  interface Statement<T, P extends unknown[]> {
    run(...params: P): RunResult
    get(...params: P): T | undefined
    all(...params: P): T[]
  }

  export class Database {
    constructor(path: string, options?: DatabaseOptions)
    exec(sql: string): void
    prepare<T, P extends unknown[]>(sql: string): Statement<T, P>
    query<T, P extends unknown[]>(sql: string): Statement<T, P>
    transaction(fn: () => void): () => void
    close(): void
  }
}

interface ImportMeta {
  readonly dir: string
  readonly file: string
}
