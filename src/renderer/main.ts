import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { vClickOutside } from './directives/clickOutside'
import './assets/main.css'

const app = createApp(App)
const pinia = createPinia()

// Register global directives
app.directive('click-outside', vClickOutside)

app.use(pinia)
app.mount('#app')
