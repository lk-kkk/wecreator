<template>
  <a-config-provider :theme="antTheme">
    <router-view />
  </a-config-provider>
</template>

<script setup lang="ts">
/**
 * WeCreator PC Admin — App Root
 * 注入 Ant Design Vue 4 全局主题（Design System V1.1）
 */
const antTheme = {
  token: {
    colorPrimary:         '#0858F4',
    colorSuccess:         '#38D048',
    colorWarning:         '#FC8C40',
    colorError:           '#E8383C',
    colorInfo:            '#0858F4',
    colorTextBase:        '#181818',
    colorBgBase:          '#FFFFFF',
    colorBgLayout:        '#F0F0F0',
    colorBorder:          '#E0E0E0',
    colorBorderSecondary: '#F0F0F0',
    borderRadius:          6,
    borderRadiusLG:        8,
    borderRadiusSM:        4,
    fontSize:              14,
    controlHeight:         36,
    controlHeightLG:       44,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif",
    boxShadow:            '0 1px 3px rgba(0,0,0,0.06)',
    boxShadowSecondary:   '0 2px 8px rgba(0,0,0,0.08)',
    motionDurationFast:   '0.15s',
    motionDurationMid:    '0.25s',
    motionDurationSlow:   '0.4s',
  },
  components: {
    Layout: {
      headerBg:     '#FFFFFF',
      headerHeight:  56,
      siderBg:      '#FFFFFF',
      bodyBg:       '#F0F0F0',
    },
    Menu: {
      itemHeight:          44,
      itemBorderRadius:     6,
      itemSelectedBg:      '#E4ECF8',
      itemSelectedColor:   '#0858F4',
      itemHoverBg:         '#F8F8F8',
      itemHoverColor:      '#181818',
      itemColor:           '#505050',
      iconSize:             16,
      itemPaddingInline:   16,
      collapsedIconSize:   18,
    },
    Button: {
      borderRadius:    6,
      fontWeight:      500,
    },
    Table: {
      headerBg:   '#F8F8F8',
      headerColor: '#505050',
      rowHoverBg:  '#F8F8F8',
      borderColor: '#E0E0E0',
      cellPaddingBlock:  12,
      cellPaddingInline: 16,
    },
    Card: {
      borderRadiusLG: 8,
      paddingLG:      20,
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Tabs: {
      inkBarColor: '#0858F4',
      itemSelectedColor: '#0858F4',
    },
    Steps: {
      colorPrimary: '#0858F4',
    },
  },
}
</script>
