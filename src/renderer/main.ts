import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import TransferWindow from '@/views/TransferWindow.vue'
import { vClickOutside } from './directives/clickOutside'
import './assets/css/main.css'

// Suppress Monaco Editor's internal "Canceled" errors during disposal
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message === 'Canceled') {
    event.preventDefault()
  }
})

const app = createApp(new URLSearchParams(window.location.search).has('operation') ? TransferWindow : App)
const pinia = createPinia()

// Register global directives
app.directive('click-outside', vClickOutside)

app.use(pinia)
app.mount('#app')
