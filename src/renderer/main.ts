import { createApp } from 'vue'
import { createPinia } from 'pinia'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import App from './App.vue'
import { vClickOutside } from './directives/clickOutside'
import './assets/css/main.css'

(self as unknown as Record<string, unknown>).MonacoEnvironment = {
  getWorker: () => new editorWorker()
}

const app = createApp(App)
const pinia = createPinia()

// Register global directives
app.directive('click-outside', vClickOutside)

app.use(pinia)
app.mount('#app')
