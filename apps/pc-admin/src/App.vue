<template>
  <a-config-provider :theme="antTheme" :locale="zhCN">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
/**
 * WeCreator PC Admin — App Root
 * Material Design 3 主题
 */
import { computed } from 'vue'
import { theme as antdTheme } from 'ant-design-vue'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { useTheme } from '@/composables/useTheme'

// 触发主题初始化（强制 light）
useTheme()

// ========== Material Design 3 Ant Design Tokens ==========
const materialToken = {
  // M3 色彩系统
  colorPrimary:         '#1B6EF3',
  colorSuccess:         '#1E8E3E',
  colorWarning:         '#E37400',
  colorError:           '#BA1A1A',
  colorInfo:            '#1B6EF3',

  // 基础色
  colorTextBase:        '#1B1B1F',
  colorBgBase:          '#FDFBFF',
  colorBgLayout:        '#FDFBFF',
  colorBorder:          '#C4C6D0',
  colorBorderSecondary: '#E1E2EC',

  // 反色
  colorTextLightSolid:  '#FFFFFF',

  // M3 Shape Scale 圆角
  borderRadius:          12,
  borderRadiusLG:        16,
  borderRadiusSM:        8,
  borderRadiusXS:        4,

  // 字号 & 高度
  fontSize:              14,
  controlHeight:         40,
  controlHeightLG:       48,
  controlHeightSM:       32,
  fontFamily:
    "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",

  // M3 Elevation 阴影
  boxShadow:           '0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 3px 1px rgba(0, 0, 0, 0.15)',
  boxShadowSecondary:  '0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)',
  boxShadowTertiary:   '0 4px 8px 3px rgba(0, 0, 0, 0.15), 0 1px 3px rgba(0, 0, 0, 0.3)',

  // M3 Motion
  motionDurationFast:  '0.15s',
  motionDurationMid:   '0.25s',
  motionDurationSlow:  '0.35s',
}

const materialComponents = {
  Layout: {
    headerBg:     '#FDFBFF',
    headerHeight: 64,
    siderBg:      '#F0EDF1',
    bodyBg:       '#FDFBFF',
    triggerBg:    '#F0EDF1',
    triggerColor: '#44474F',
  },
  Menu: {
    itemHeight:          48,
    itemBorderRadius:    100,
    itemBg:              'transparent',
    subMenuItemBg:       'transparent',
    itemSelectedBg:      '#DAE2F9',
    itemSelectedColor:   '#131C2B',
    itemHoverBg:         'rgba(27, 27, 31, 0.08)',
    itemHoverColor:      '#1B1B1F',
    itemColor:           '#44474F',
    iconSize:             24,
    itemPaddingInline:   16,
    collapsedIconSize:   24,
  },
  Button: {
    borderRadius:             100,
    fontWeight:               500,
    controlHeight:            40,
    controlHeightLG:          48,
    controlHeightSM:          32,
    primaryColor:             '#FFFFFF',
    colorTextLightSolid:      '#FFFFFF',
    defaultColor:             '#1B6EF3',
    defaultBg:                'transparent',
    defaultBorderColor:       '#74777F',
    defaultHoverBg:           'rgba(27, 110, 243, 0.08)',
    defaultHoverColor:        '#1B6EF3',
    defaultHoverBorderColor:  '#74777F',
    textHoverBg:              'rgba(27, 110, 243, 0.08)',
    paddingInline:            24,
    paddingInlineLG:          24,
    paddingInlineSM:          16,
    primaryShadow:            'none',
  },
  Table: {
    headerBg:          '#F0EDF1',
    headerColor:       '#44474F',
    rowHoverBg:        'rgba(27, 27, 31, 0.08)',
    borderColor:       '#C4C6D0',
    cellPaddingBlock:  16,
    cellPaddingInline: 16,
    headerSplitColor:  '#C4C6D0',
  },
  Card: {
    borderRadiusLG:        12,
    paddingLG:             24,
    headerBg:              '#F6F3F7',
    colorBorderSecondary:  '#C4C6D0',
  },
  Modal: {
    borderRadiusLG:  28,
    contentBg:       '#EAE7EC',
    headerBg:        'transparent',
    titleColor:      '#1B1B1F',
    titleFontSize:   24,
  },
  Tabs: {
    inkBarColor:      '#1B6EF3',
    itemSelectedColor:'#1B6EF3',
    itemHoverColor:   '#1B6EF3',
    itemColor:        '#44474F',
    horizontalItemPadding: '16px 24px',
  },
  Steps: {
    colorPrimary: '#1B6EF3',
  },
  Input: {
    borderRadius:      4,
    controlHeight:     40,
    colorBgContainer:  '#E4E1E6',
    colorBorder:       '#74777F',
    activeBorderColor: '#1B6EF3',
    hoverBorderColor:  '#1B1B1F',
    activeShadow:      'none',
  },
  Select: {
    borderRadius:     4,
    controlHeight:    40,
    colorBgContainer: '#E4E1E6',
    optionSelectedBg: '#DAE2F9',
    optionActiveBg:   'rgba(27, 27, 31, 0.08)',
  },
  DatePicker: {
    borderRadius:     4,
    controlHeight:    40,
    colorBgContainer: '#E4E1E6',
  },
  Checkbox: {
    borderRadiusSM: 2,
    colorPrimary:   '#1B6EF3',
  },
  Radio: {
    colorPrimary:    '#1B6EF3',
    buttonBg:        'transparent',
    buttonCheckedBg: '#1B6EF3',
  },
  Switch: {
    colorPrimary: '#1B6EF3',
  },
  Tag: {
    borderRadiusSM: 8,
  },
  Badge: {
    colorBgContainer: '#FDFBFF',
  },
  Dropdown: {
    borderRadiusLG:  4,
    controlPaddingHorizontal: 16,
    colorBgElevated: '#F0EDF1',
    boxShadowSecondary: '0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)',
  },
  Popover: {
    borderRadiusLG:  12,
    colorBgElevated: '#F0EDF1',
    boxShadowSecondary: '0 1px 2px rgba(0, 0, 0, 0.3), 0 2px 6px 2px rgba(0, 0, 0, 0.15)',
  },
  Tooltip: {
    borderRadius:  4,
    colorBgSpotlight: '#303034',
  },
  Notification: {
    borderRadiusLG:  12,
  },
  Message: {
    borderRadiusLG:  4,
  },
  Alert: {
    borderRadiusLG:  12,
  },
  Progress: {
    defaultColor: '#1B6EF3',
  },
}

const antTheme = computed(() => ({
  token: materialToken,
  components: materialComponents,
  algorithm: antdTheme.defaultAlgorithm,
}))
</script>
