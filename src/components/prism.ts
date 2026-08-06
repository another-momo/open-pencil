import Prism from 'prismjs'

// Prism language components (e.g. prism-jsx) reference a global `Prism`.
// prism.js only assigns it when `typeof global !== 'undefined'`, which is
// never true in bundled browser builds — so production bundles crash with
// "ReferenceError: Prism is not defined" while dev works (esbuild pre-bundling
// shims `global`). Expose it explicitly before importing any language component.
;(globalThis as { Prism?: unknown }).Prism = Prism

export default Prism
