import { createHead } from '@unhead/vue/client'
import { createApp } from 'vue'

import './app.css'
import { attachPiBackendTransport } from '@/app/ai/pi-backend/attach'
import { preloadFonts } from '@/app/editor/fonts'

import App from './App.vue'
import router from './router'

attachPiBackendTransport()

preloadFonts()
const head = createHead()
createApp(App).use(router).use(head).mount('#app')
