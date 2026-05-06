import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// Material Design 3 主题系统 —— 必须在其他样式前加载（tokens 优先定义）
import './styles/theme-material.css'
// 全局样式（Reset + 基础 Ant 组件覆盖）
import './style.css'
// Material Design 3 组件样式
import './styles/material-components.css'
// Material Design 3 全局增强覆盖
import './styles/material-overrides.css'
// 响应式
import './assets/responsive.css'

// 触发主题初始化（立即把 data-theme 设到 <html>，避免 FOUC）
import './composables/useTheme'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
