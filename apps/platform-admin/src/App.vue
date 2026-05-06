<template>
  <a-config-provider :theme="antTheme" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
/**
 * WeCreator Platform Admin — App Root
 * 统一亮色主题（已移除一键换肤）
 * 参照 uipic.png：纯白背景 + 蓝色渐变主色
 */
import { computed } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useTheme } from '@/composables/useTheme'

// 触发主题初始化（强制 light）
useTheme()

// ========== Ant Design Vue Tokens ==========
const lightToken = {
  // 品牌色 —— 现代蓝
  colorPrimary:         '#3D7EFF',
  colorSuccess:         '#12B76A',
  colorWarning:         '#F79009',
  colorError:           '#F04438',
  colorInfo:            '#3D7EFF',

  // 基础色
  colorTextBase:        '#1D2939',
  colorBgBase:          '#FFFFFF',
  colorBgLayout:        '#FFFFFF',
  colorBorder:          '#EAECF0',
  colorBorderSecondary: '#F2F4F7',

  // 反色
  colorTextLightSolid:  '#FFFFFF',

  // 圆角
  borderRadius:          10,
  borderRadiusLG:        14,
  borderRadiusSM:        6,
  borderRadiusXS:        4,

  // 字号 & 高度
  fontSize:              14,
  controlHeight:         36,
  controlHeightLG:       44,
  controlHeightSM:       28,
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",

  // 阴影（轻柔）
  boxShadow:           '0 1px 3px rgba(16, 24, 40, 0.06), 0 1px 2px rgba(16, 24, 40, 0.04)',
  boxShadowSecondary:  '0 4px 8px -2px rgba(16, 24, 40, 0.06), 0 2px 4px -2px rgba(16, 24, 40, 0.04)',
  boxShadowTertiary:   '0 1px 2px rgba(16, 24, 40, 0.05)',

  // 动画
  motionDurationFast:  '0.15s',
  motionDurationMid:   '0.25s',
  motionDurationSlow:  '0.35s',
}

const lightComponents = {
  Layout: {
    headerBg:     '#FFFFFF',
    headerHeight: 56,
    siderBg:      '#FFFFFF',
    bodyBg:       '#FFFFFF',
    triggerBg:    '#FFFFFF',
    triggerColor: '#667085',
  },
  Menu: {
    itemHeight:          40,
    itemBorderRadius:     8,
    itemBg:              'transparent',
    subMenuItemBg:       'transparent',
    itemSelectedBg:      '#EEF2F8',
    itemSelectedColor:   '#2B6BE5',
    itemHoverBg:         '#F5F7FA',
    itemHoverColor:      '#1D2939',
    itemColor:           '#475467',
    iconSize:             16,
    itemPaddingInline:   14,
    collapsedIconSize:   18,
  },
  Button: {
    borderRadius:             10,
    fontWeight:               500,
    controlHeight:            36,
    controlHeightLG:          44,
    controlHeightSM:          28,
    primaryColor:             '#FFFFFF',
    colorTextLightSolid:      '#FFFFFF',
    defaultColor:             '#1D2939',
    defaultBg:                '#FFFFFF',
    defaultBorderColor:       '#EAECF0',
    defaultHoverBg:           '#F5F7FA',
    defaultHoverColor:        '#3D7EFF',
    defaultHoverBorderColor:  '#C5D7FD',
    textHoverBg:              '#F5F7FA',
    paddingInline:            16,
    paddingInlineLG:          20,
    paddingInlineSM:          12,
    primaryShadow:            '0 2px 4px rgba(43, 107, 229, 0.20)',
  },
  Table: {
    headerBg:          '#FAFBFC',
    headerColor:       '#475467',
    rowHoverBg:        '#FAFBFC',
    borderColor:       '#F2F4F7',
    cellPaddingBlock:  14,
    cellPaddingInline: 16,
    headerSplitColor:  '#F2F4F7',
  },
  Card: {
    borderRadiusLG:        14,
    paddingLG:             24,
    headerBg:              '#FFFFFF',
    colorBorderSecondary:  '#EAECF0',
  },
  Modal: {
    borderRadiusLG:  20,
    contentBg:       '#FFFFFF',
    headerBg:        '#FFFFFF',
    titleColor:      '#1D2939',
    titleFontSize:   18,
  },
  Tabs: {
    inkBarColor:      '#3D7EFF',
    itemSelectedColor:'#3D7EFF',
    itemHoverColor:   '#2B6BE5',
    itemColor:        '#475467',
    horizontalItemPadding: '12px 16px',
  },
  Steps: {
    colorPrimary: '#3D7EFF',
  },
  Input: {
    borderRadius:      10,
    controlHeight:     36,
    colorBgContainer:  '#FFFFFF',
    colorBorder:       '#EAECF0',
    activeBorderColor: '#3D7EFF',
    hoverBorderColor:  '#C5D7FD',
    activeShadow:      '0 0 0 4px rgba(78, 140, 255, 0.18)',
  },
  Select: {
    borderRadius:     10,
    controlHeight:    36,
    colorBgContainer: '#FFFFFF',
    optionSelectedBg: '#EEF2F8',
    optionActiveBg:   '#F5F7FA',
  },
  DatePicker: {
    borderRadius:     10,
    controlHeight:    36,
    colorBgContainer: '#FFFFFF',
  },
  Checkbox: {
    borderRadiusSM: 4,
    colorPrimary:   '#3D7EFF',
  },
  Radio: {
    colorPrimary:    '#3D7EFF',
    buttonBg:        '#FFFFFF',
    buttonCheckedBg: '#3D7EFF',
  },
  Switch: {
    colorPrimary: '#3D7EFF',
  },
  Tag: {
    borderRadiusSM: 6,
  },
  Badge: {
    colorBgContainer: '#FFFFFF',
  },
  Dropdown: {
    borderRadiusLG:  10,
    controlPaddingHorizontal: 12,
    colorBgElevated: '#FFFFFF',
    boxShadowSecondary: '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.04)',
  },
  Popover: {
    borderRadiusLG:  12,
    colorBgElevated: '#FFFFFF',
    boxShadowSecondary: '0 12px 16px -4px rgba(16, 24, 40, 0.08), 0 4px 6px -2px rgba(16, 24, 40, 0.04)',
  },
  Tooltip: {
    borderRadius:  8,
    colorBgSpotlight: 'rgba(29, 41, 57, 0.95)',
  },
  Notification: {
    borderRadiusLG:  12,
  },
  Message: {
    borderRadiusLG:  10,
  },
  Alert: {
    borderRadiusLG:  10,
  },
  Progress: {
    defaultColor: '#3D7EFF',
  },
}

const antTheme = computed(() => ({
  token: lightToken,
  components: lightComponents,
  algorithm: antdTheme.defaultAlgorithm,
}))
</script>
