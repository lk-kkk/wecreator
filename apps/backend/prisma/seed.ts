import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 开始插入种子数据...');

  // ================================================================
  // 1. 平台角色（20个）
  // ================================================================
  const platformRoles = [
    { roleName: '摄影师', category: '影像', description: '商业摄影、产品摄影、人像摄影', suggestedDaily: 800, skillTags: '商业摄影,人像,产品拍摄' },
    { roleName: '摄像师', category: '影像', description: '视频拍摄、直播录制', suggestedDaily: 1000, skillTags: '视频拍摄,直播,纪录片' },
    { roleName: '视频剪辑师', category: '影像', description: '短视频剪辑、后期特效', suggestedDaily: 600, skillTags: 'Premiere,Final Cut,达芬奇' },
    { roleName: '平面设计师', category: '设计', description: '海报、画册、VI设计', suggestedDaily: 700, skillTags: 'Photoshop,Illustrator,InDesign' },
    { roleName: 'UI设计师', category: '设计', description: 'APP界面、网页设计', suggestedDaily: 800, skillTags: 'Figma,Sketch,UI设计' },
    { roleName: '3D设计师', category: '设计', description: '三维建模、产品渲染', suggestedDaily: 900, skillTags: 'C4D,Blender,3DMax' },
    { roleName: '插画师', category: '设计', description: '商业插画、IP形象设计', suggestedDaily: 700, skillTags: '插画,Procreate,手绘' },
    { roleName: '文案策划', category: '内容', description: '品牌文案、广告语、软文', suggestedDaily: 500, skillTags: '品牌文案,广告语,软文' },
    { roleName: '内容运营', category: '内容', description: '公众号运营、内容策划', suggestedDaily: 500, skillTags: '公众号,小红书,内容策划' },
    { roleName: '短视频编导', category: '内容', description: '短视频脚本、分镜策划', suggestedDaily: 600, skillTags: '脚本,分镜,抖音' },
    { roleName: '直播运营', category: '运营', description: '直播策划、场控、数据复盘', suggestedDaily: 500, skillTags: '直播,场控,数据分析' },
    { roleName: '社群运营', category: '运营', description: '社群搭建、用户运营', suggestedDaily: 400, skillTags: '社群,企业微信,用户运营' },
    { roleName: '活动策划', category: '运营', description: '线下活动、展会策划执行', suggestedDaily: 600, skillTags: '活动策划,展会,线下执行' },
    { roleName: '翻译', category: '语言', description: '中英/中日翻译、本地化', suggestedDaily: 500, skillTags: '英语翻译,日语翻译,本地化' },
    { roleName: '配音演员', category: '音频', description: '广告配音、有声书录制', suggestedDaily: 600, skillTags: '配音,有声书,广告' },
    { roleName: '化妆师', category: '造型', description: '商业拍摄化妆、活动造型', suggestedDaily: 600, skillTags: '商业化妆,造型,特效妆' },
    { roleName: '模特', category: '造型', description: '商品模特、平面模特', suggestedDaily: 800, skillTags: '平面模特,电商模特,走秀' },
    { roleName: '前端开发', category: '技术', description: 'Web/小程序前端开发', suggestedDaily: 1000, skillTags: 'Vue,React,小程序' },
    { roleName: '后端开发', category: '技术', description: '服务端API开发', suggestedDaily: 1200, skillTags: 'Node.js,Java,Python' },
    { roleName: '数据分析师', category: '技术', description: '数据采集、分析、可视化', suggestedDaily: 800, skillTags: 'SQL,Python,Tableau' },
  ];

  for (const role of platformRoles) {
    await prisma.platformRole.upsert({
      where: { roleName: role.roleName },
      update: role,
      create: role,
    });
  }
  console.log(`  ✅ 平台角色: ${platformRoles.length} 个`);

  // ================================================================
  // 2. 技能标签（100个）
  // ================================================================
  const skillTags = [
    // 影像（15）
    { name: '商业摄影', category: '影像', hot: true },
    { name: '人像摄影', category: '影像', hot: true },
    { name: '产品拍摄', category: '影像', hot: true },
    { name: '航拍', category: '影像', hot: false },
    { name: '视频拍摄', category: '影像', hot: true },
    { name: '短视频', category: '影像', hot: true },
    { name: 'Premiere', category: '影像', hot: true },
    { name: 'Final Cut', category: '影像', hot: false },
    { name: '达芬奇调色', category: '影像', hot: false },
    { name: 'After Effects', category: '影像', hot: true },
    { name: '直播拍摄', category: '影像', hot: true },
    { name: '纪录片', category: '影像', hot: false },
    { name: 'Vlog', category: '影像', hot: true },
    { name: '延时摄影', category: '影像', hot: false },
    { name: '动画制作', category: '影像', hot: false },
    // 设计（20）
    { name: 'Photoshop', category: '设计', hot: true },
    { name: 'Illustrator', category: '设计', hot: true },
    { name: 'InDesign', category: '设计', hot: false },
    { name: 'Figma', category: '设计', hot: true },
    { name: 'Sketch', category: '设计', hot: true },
    { name: 'UI设计', category: '设计', hot: true },
    { name: 'UX设计', category: '设计', hot: true },
    { name: '海报设计', category: '设计', hot: true },
    { name: '画册设计', category: '设计', hot: false },
    { name: 'VI设计', category: '设计', hot: true },
    { name: 'Logo设计', category: '设计', hot: true },
    { name: '包装设计', category: '设计', hot: true },
    { name: 'C4D', category: '设计', hot: true },
    { name: 'Blender', category: '设计', hot: true },
    { name: '3DMax', category: '设计', hot: false },
    { name: '产品渲染', category: '设计', hot: false },
    { name: '插画', category: '设计', hot: true },
    { name: 'Procreate', category: '设计', hot: true },
    { name: '手绘', category: '设计', hot: false },
    { name: 'IP形象设计', category: '设计', hot: true },
    // 内容（15）
    { name: '品牌文案', category: '内容', hot: true },
    { name: '广告语', category: '内容', hot: true },
    { name: '软文撰写', category: '内容', hot: false },
    { name: '公众号运营', category: '内容', hot: true },
    { name: '小红书', category: '内容', hot: true },
    { name: '抖音', category: '内容', hot: true },
    { name: '脚本撰写', category: '内容', hot: true },
    { name: '分镜设计', category: '内容', hot: false },
    { name: 'SEO优化', category: '内容', hot: false },
    { name: '新闻稿', category: '内容', hot: false },
    { name: '演讲稿', category: '内容', hot: false },
    { name: '产品描述', category: '内容', hot: true },
    { name: '种草文', category: '内容', hot: true },
    { name: '知乎回答', category: '内容', hot: false },
    { name: '内容策划', category: '内容', hot: true },
    // 运营（10）
    { name: '直播', category: '运营', hot: true },
    { name: '场控', category: '运营', hot: false },
    { name: '数据分析', category: '运营', hot: true },
    { name: '社群运营', category: '运营', hot: true },
    { name: '企业微信', category: '运营', hot: false },
    { name: '用户运营', category: '运营', hot: true },
    { name: '活动策划', category: '运营', hot: true },
    { name: '展会执行', category: '运营', hot: false },
    { name: '线下执行', category: '运营', hot: false },
    { name: '私域流量', category: '运营', hot: true },
    // 语言（10）
    { name: '英语翻译', category: '语言', hot: true },
    { name: '日语翻译', category: '语言', hot: false },
    { name: '韩语翻译', category: '语言', hot: false },
    { name: '本地化', category: '语言', hot: true },
    { name: '字幕翻译', category: '语言', hot: true },
    { name: '同声传译', category: '语言', hot: false },
    { name: '法语翻译', category: '语言', hot: false },
    { name: '德语翻译', category: '语言', hot: false },
    { name: '西班牙语翻译', category: '语言', hot: false },
    { name: '口译', category: '语言', hot: false },
    // 音频（5）
    { name: '配音', category: '音频', hot: true },
    { name: '有声书', category: '音频', hot: true },
    { name: '广告配音', category: '音频', hot: false },
    { name: '音乐制作', category: '音频', hot: false },
    { name: '播客', category: '音频', hot: true },
    // 造型（5）
    { name: '商业化妆', category: '造型', hot: true },
    { name: '造型设计', category: '造型', hot: false },
    { name: '特效妆', category: '造型', hot: false },
    { name: '平面模特', category: '造型', hot: true },
    { name: '电商模特', category: '造型', hot: true },
    // 技术（15）
    { name: 'Vue', category: '技术', hot: true },
    { name: 'React', category: '技术', hot: true },
    { name: '小程序开发', category: '技术', hot: true },
    { name: 'Node.js', category: '技术', hot: true },
    { name: 'Java', category: '技术', hot: true },
    { name: 'Python', category: '技术', hot: true },
    { name: 'SQL', category: '技术', hot: true },
    { name: 'Tableau', category: '技术', hot: false },
    { name: 'Flutter', category: '技术', hot: true },
    { name: 'Swift', category: '技术', hot: false },
    { name: 'Kotlin', category: '技术', hot: false },
    { name: 'Go', category: '技术', hot: true },
    { name: 'Docker', category: '技术', hot: false },
    { name: 'AWS', category: '技术', hot: false },
    { name: 'TypeScript', category: '技术', hot: true },
  ];

  for (const tag of skillTags) {
    await prisma.skillTag.upsert({
      where: { name: tag.name },
      update: tag,
      create: tag,
    });
  }
  console.log(`  ✅ 技能标签: ${skillTags.length} 个`);

  // ================================================================
  // 3. 开发用平台超级管理员（仅库中不存在 admin 时创建）
  // ================================================================
  const existingAdmin = await prisma.platformAdmin.findUnique({ where: { username: 'admin' } });
  if (!existingAdmin) {
    const devPassword = process.env.PLATFORM_ADMIN_DEV_PASSWORD ?? 'Admin@2026';
    const passwordHash = await bcrypt.hash(devPassword, 10);
    await prisma.platformAdmin.create({
      data: {
        username: 'admin',
        passwordHash,
        displayName: '超级管理员',
        role: 'platform_super_admin',
        status: 'active',
      },
    });
    console.log('  ✅ 平台管理员: 用户名 admin（密码为 PLATFORM_ADMIN_DEV_PASSWORD 或默认 Admin@2026）');
  } else {
    console.log('  ⏭  平台管理员 admin 已存在，跳过创建');
  }

  // ================================================================
  // 4. 统计
  // ================================================================
  const roleCount = await prisma.platformRole.count();
  const tagCount = await prisma.skillTag.count();
  console.log(`\n🎉 种子数据完成: ${roleCount} 角色, ${tagCount} 标签`);
}

main()
  .catch((e) => {
    console.error('❌ 种子数据失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
