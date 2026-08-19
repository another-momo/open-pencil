import { createRouter, createWebHistory } from 'vue-router'

import EditorView from './views/EditorView.vue'
import StorageView from './views/StorageView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: EditorView },
    { path: '/storage', component: StorageView }
  ]
})

export default router
