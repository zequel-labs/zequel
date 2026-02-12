import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { vClickOutside } from './directives/clickOutside'
import './assets/css/main.css'

// Suppress Monaco Editor's internal "Canceled" errors during disposal
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason?.message === 'Canceled') {
    event.preventDefault()
  }
})

const app = createApp(App)
const pinia = createPinia()

// Register global directives
app.directive('click-outside', vClickOutside)

app.use(pinia)
app.mount('#app')
