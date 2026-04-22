/**
 * Prisma Schema ↔ MySQL DB Drift 检测
 * 用法: cd apps/backend && npx ts-node prisma/check-drift.ts
 *
 * 原理: 读 schema.prisma 中每个 model 的字段 @map,
 *       对比 MySQL SHOW COLUMNS,列出缺失字段。
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

async function main() {
  const schemaPath = path.resolve(__dirname, 'schema.prisma');
  const schemaRaw = fs.readFileSync(schemaPath, 'utf-8');

  // 解析所有 model { ... } 块,提取 @map("xxx") 或字段名
  const modelBlocks = Array.from(schemaRaw.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm));
  const p = new PrismaClient();

  let totalDrifts = 0;
  for (const [, modelName, body] of modelBlocks) {
    // 找表名: @@map("xxx"),否则 snake_case 复数化(简化处理)
    const tableMapMatch = body.match(/@@map\("([^"]+)"\)/);
    const tableName = tableMapMatch
      ? tableMapMatch[1]
      : modelName.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '') + 's';

    // 提取字段的 @map("xxx") 或驼峰转下划线
    const fieldLines = body.split('\n').filter(l => /^\s+\w+\s+/.test(l) && !l.trim().startsWith('//') && !l.trim().startsWith('@@'));
    const expectedCols: string[] = [];
    for (const line of fieldLines) {
      const mapMatch = line.match(/@map\("([^"]+)"\)/);
      if (mapMatch) {
        expectedCols.push(mapMatch[1]);
      } else {
        const nameMatch = line.match(/^\s+(\w+)\s+/);
        if (nameMatch && !/^(task|company|project|user|author|manager|creator|assign|deliverable|comment|checkpoint|issue|milestone|transaction|role)$/i.test(nameMatch[1])) {
          // 跳过关系字段 (启发式:小写开头且后面不带类型修饰)
          const rest = line.substring(line.indexOf(nameMatch[1]) + nameMatch[1].length).trim();
          if (!/^[A-Z]\w*(\[\])?(\s|$)/.test(rest) || /@default|@id|@unique|@db\.|@updatedAt|DateTime|String|Int|BigInt|Boolean|Decimal|Json/.test(rest)) {
            expectedCols.push(nameMatch[1].replace(/([A-Z])/g, '_$1').toLowerCase());
          }
        }
      }
    }

    try {
      const rows: any = await p.$queryRawUnsafe(`SHOW COLUMNS FROM \`${tableName}\``);
      const actualCols = rows.map((r: any) => r.Field);
      const missing = expectedCols.filter(c => !actualCols.includes(c));
      if (missing.length > 0) {
        console.log(`❌ ${modelName} (${tableName}) 缺失列: ${missing.join(', ')}`);
        totalDrifts += missing.length;
      }
    } catch (e: any) {
      if (/doesn't exist/.test(e.message)) {
        console.log(`⚠️  表不存在: ${modelName} (${tableName})`);
      }
    }
  }
  await p.$disconnect();

  if (totalDrifts === 0) {
    console.log('\n✅ 无 drift,schema 与 DB 一致');
  } else {
    console.log(`\n❌ 共 ${totalDrifts} 处 drift,建议创建补丁迁移`);
    process.exitCode = 1;
  }
}

main().catch(e => { console.error(e); process.exit(1); });
