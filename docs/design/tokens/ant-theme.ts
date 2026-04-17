/**
 * WeCreator Ant Design Vue 4 Theme Configuration V1.1
 *
 * V1.1 更新（2026-04-17）：
 *   - 主色 #0858F4，bodyBg #F0F0F0，状态色全量更新
 *   - 新增 taskStatusColors 青绿执行中、紫色优质零工
 *
 * 使用方式：
 *   import { antTheme } from './design/tokens/ant-theme'
 *   <a-config-provider :theme="antTheme"><App /></a-config-provider>
 */

import type { ThemeConfig } from 'ant-design-vue/es/config-provider/context';

export const antTheme: ThemeConfig = {
  token: {
    // 品牌色（V1.1）
    colorPrimary:  '#0858F4',
    colorSuccess:  '#38D048',
    colorWarning:  '#FC8C40',
    colorError:    '#E8383C',
    colorInfo:     '#0858F4',

    // 文字色（V1.1）
    colorTextBase:        '#181818',
    colorText:            '#181818',
    colorTextSecondary:   '#505050',
    colorTextTertiary:    '#888888',
    colorTextQuaternary:  '#C0C0C0',

    // 背景色（V1.1）
    colorBgBase:       '#FFFFFF',
    colorBgLayout:     '#F0F0F0',   // ★ 核心变更
    colorBgContainer:  '#FFFFFF',
    colorBgElevated:   '#FFFFFF',

    // 边框（V1.1）
    colorBorder:          '#E0E0E0',
    colorBorderSecondary: '#F0F0F0',

    // 圆角
    borderRadius:   6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // 字体
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', sans-serif",
    fontSize:   14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 20,
    fontSizeHeading1: 24,
    fontSizeHeading2: 20,
    fontSizeHeading3: 16,
    fontSizeHeading4: 14,

    // 行高
    lineHeight:   1.5714,
    lineHeightLG: 1.5,
    lineHeightSM: 1.5,

    // 控件尺寸
    controlHeight:   36,
    controlHeightLG: 44,
    controlHeightSM: 28,

    // 阴影（V1.1：更轻薄）
    boxShadow:          '0 1px 3px rgba(0,0,0,0.06)',
    boxShadowSecondary: '0 2px 8px rgba(0,0,0,0.08)',

    // 动效
    motionDurationFast: '0.15s',
    motionDurationMid:  '0.25s',
    motionDurationSlow: '0.4s',
    motionEaseInOut:    'cubic-bezier(0.4, 0, 0.2, 1)',
    motionEaseOut:      'cubic-bezier(0, 0, 0.2, 1)',
    motionEaseIn:       'cubic-bezier(0.4, 0, 1, 1)',
  },

  components: {
    // 布局（V1.1：bodyBg更新）
    Layout: {
      headerBg:     '#FFFFFF',
      headerHeight: 56,
      headerPadding:'0 24px',
      siderBg:      '#FFFFFF',
      bodyBg:       '#F0F0F0',   // ★ 核心变更
    },

    // 侧边菜单（V1.1：选中色更新）
    Menu: {
      itemHeight:         44,
      itemBorderRadius:   6,
      itemSelectedBg:     '#D0DCFC',   // V1.1 更新
      itemSelectedColor:  '#0858F4',   // V1.1 更新
      itemHoverBg:        '#F8F8F8',
      iconSize:           20,
      itemPaddingInline:  16,
    },

    // 按钮
    Button: {
      controlHeight:   36,
      controlHeightLG: 44,
      controlHeightSM: 28,
      borderRadius:    6,
      fontWeight:      500,
    },

    // 输入框
    Input: {
      controlHeight:   36,
      borderRadius:    6,
      activeBorderColor:  '#0858F4',   // V1.1 更新
      hoverBorderColor:   '#A0BCF8',   // V1.1 更新
      activeShadow:       '0 0 0 3px rgba(8,88,244,0.12)',   // V1.1 更新
      errorActiveShadow:  '0 0 0 3px rgba(232,56,60,0.12)',  // V1.1 更新
    },

    // 选择器
    Select: {
      controlHeight: 36,
      borderRadius:  6,
    },

    // 表格（V1.1）
    Table: {
      headerBg:      '#F8F8F8',
      headerColor:   '#505050',
      rowHoverBg:    '#F8F8F8',
      borderColor:   '#E0E0E0',   // V1.1 更新
      cellPaddingBlock:  14,
      cellPaddingInline: 16,
    },

    // 卡片（V1.1：阴影轻薄化）
    Card: {
      borderRadiusLG: 8,
      paddingLG:      20,
      boxShadow:      '0 1px 3px rgba(0,0,0,0.06)',  // V1.1 更新
    },

    // 弹窗
    Modal: {
      borderRadiusLG: 12,
      paddingMD:      24,
    },

    // 骨架屏（V1.1：适配新背景色）
    Skeleton: {
      gradientFromColor: '#EEEEEE',
      gradientToColor:   '#F8F8F8',
    },

    // 分页
    Pagination: {
      itemActiveBg: '#0858F4',   // V1.1 更新
      borderRadius: 6,
    },

    // 步骤条
    Steps: {
      iconSize:          32,
      colorPrimary:      '#0858F4',
    },

    // 进度条
    Progress: {
      lineBorderRadius:   4,
      colorSuccess:       '#38D048',
    },

    // Tag
    Tag: {
      borderRadiusSM: 4,
    },

    // 面包屑
    Breadcrumb: {
      itemColor:      '#888888',
      lastItemColor:  '#181818',
      linkColor:      '#505050',
      linkHoverColor: '#0858F4',
    },

    // 日期选择
    DatePicker: {
      controlHeight: 36,
      borderRadius:  6,
    },

    // 通知
    Notification: {
      width: 384,
    },
  },
};

/**
 * 任务状态色映射（V1.1 全量更新）
 * 用于 Tag 组件的自定义颜色或 CSS style
 */
export const taskStatusColors = {
  draft:       { color: '#888888', bg: '#F0F0F0' },
  matching:    { color: '#0858F4', bg: '#D0DCFC' },
  in_progress: { color: '#34B8A8', bg: '#D0F4F0' },  // V1.1: 青绿，区分撮合中
  reviewing:   { color: '#FC6400', bg: '#FEE8D5' },
  completed:   { color: '#38D048', bg: '#E8FCEC' },
  closed:      { color: '#888888', bg: '#EEEEEE' },
} as const;

/**
 * 小程序端特殊标签色（V1.1 新增）
 */
export const mpBadgeColors = {
  premium_worker: { color: '#E04CFC', bg: '#F8E4FC' },  // 优质零工
  teal_status:    { color: '#34B8A8', bg: '#D0F4F0' },  // 执行中
} as const;

/**
 * 金融色映射（V1.1 更新）
 */
export const financeColors = {
  income:  '#38D048',  // 收入（原#10B981）
  expense: '#E8383C',  // 支出（原#EF4444）
  frozen:  '#FC6400',  // 冻结
} as const;
