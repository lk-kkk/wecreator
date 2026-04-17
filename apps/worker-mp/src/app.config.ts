export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/marketplace/index',
    'pages/message/index',
    'pages/my/index',
    'pages/home/recommend',
    'pages/profile/index',
    'pages/profile/card',
    'pages/profile/level',
  ],
  subPackages: [
    {
      root: 'subpackages/task',
      pages: [
        'pages/detail/index',
        'pages/execute/index',
        'pages/checkin/index',
        'pages/workhour/index',
        'pages/review/index',
        'pages/dispute/index',
      ],
    },
    {
      root: 'subpackages/marketplace',
      pages: ['pages/detail/index'],
    },
    {
      root: 'subpackages/wallet',
      pages: ['pages/index/index', 'pages/withdraw/index'],
    },
    {
      root: 'subpackages/auth',
      pages: ['pages/verify/index', 'pages/profile-edit/index'],
    },
    {
      root: 'subpackages/profile',
      pages: ['pages/portfolio/index', 'pages/settings/index', 'pages/applications/index'],
    },
  ],
  preloadRule: {
    'pages/index/index': {
      network: 'all',
      packages: ['subpackages/task'],
    },
    'pages/marketplace/index': {
      network: 'all',
      packages: ['subpackages/marketplace'],
    },
    'pages/my/index': {
      network: 'all',
      packages: ['subpackages/profile', 'subpackages/wallet', 'subpackages/auth'],
    },
  },
  tabBar: {
    color: '#999',
    selectedColor: '#5B4CDB',
    backgroundColor: '#fff',
    list: [
      { pagePath: 'pages/index/index', text: '首页' },
      { pagePath: 'pages/marketplace/index', text: '服务广场' },
      { pagePath: 'pages/message/index', text: '消息' },
      { pagePath: 'pages/my/index', text: '我的' },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#5B4CDB',
    navigationBarTitleText: 'WeCreator',
    navigationBarTextStyle: 'white',
  },
})
