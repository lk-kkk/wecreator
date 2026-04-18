/// <reference types="@tarojs/taro" />

// ── SCSS 模块声明 ────────────────────────────────
declare module '*.scss' {
  const content: Record<string, string>
  export default content
}

declare module '*.css' {
  const content: Record<string, string>
  export default content
}

// ── 图片资源声明 ─────────────────────────────────
declare module '*.png' {
  const src: string
  export default src
}

declare module '*.jpg' {
  const src: string
  export default src
}

declare module '*.svg' {
  const src: string
  export default src
}

// ── 环境变量 ─────────────────────────────────────
declare namespace NodeJS {
  interface ProcessEnv {
    TARO_APP_API_BASE?: string
    NODE_ENV: 'development' | 'production' | 'test'
  }
}

// ── 全局对象 ────────────────────────────────────
declare const process: {
  env: {
    TARO_APP_API_BASE?: string
    NODE_ENV: string
    [key: string]: string | undefined
  }
}

// ── 全局定时器（小程序环境可用）─────────────────
declare function setTimeout(callback: (...args: any[]) => void, delay?: number, ...args: any[]): number
declare function clearTimeout(id: number): void
declare function setInterval(callback: (...args: any[]) => void, delay?: number, ...args: any[]): number
declare function clearInterval(id: number): void
declare function atob(data: string): string
declare function btoa(data: string): string
