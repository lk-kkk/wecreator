import { createApp } from 'vue'
import { createPinia } from 'pinia'
import Antd from 'ant-design-vue'
import 'ant-design-vue/dist/reset.css'

// 主题系统 —— tokens 必须优先
import './styles/theme-apple.css'
// 原有全局样式
import './style.css'
// Apple 风格细节
import './styles/apple-details.css'
// UI 增强样式（渐变按钮/卡片/菜单）—— 优先级最高
import './styles/ui-enhancements.css'
import './assets/responsive.css'

// 触发主题初始化
import './composables/useTheme'

import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(Antd)
app.mount('#app')
