import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// 主题系统 —— 必须在其他样式前加载（tokens 优先定义）
import './styles/theme-apple.css'
// 全局样式（Reset + Ant 组件覆盖）
import './style.css'
// Apple 风格细节增强（按钮/毛玻璃/滚动条/暗色组件补丁）
import './styles/apple-details.css'
// UI 增强样式（渐变按钮/卡片/菜单）—— 优先级最高
import './styles/ui-enhancements.css'
// 响应式
import './assets/responsive.css'

// 触发主题初始化（立即把 data-theme 设到 <html>，避免 FOUC）
import './composables/useTheme'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
