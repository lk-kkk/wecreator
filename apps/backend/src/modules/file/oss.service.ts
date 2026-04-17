/**
 * OssService  —  阿里云 OSS 预签名 + CDN 加速
 *
 * 功能：
 *   1. 客户端直传预签名 PUT URL（10 分钟有效）
 *   2. 生成公开访问 URL（CDN / OSS 源站二选一）
 *   3. 开发环境 mock：无需真实 AK/SK，返回模拟 URL
 *   4. 文件类型 & 大小校验（服务端策略与前端规则一致）
 */
import { Injectable, BadRequestException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { extname } from 'path';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OSS = require('ali-oss');
type OSSClient = InstanceType<typeof OSS>;

// ── 文件类别规则（与 file.service.ts 保持一致） ──────────
export const FILE_RULES: Record<string, { exts: string[]; maxMB: number; contentType: string }> = {
  avatar:      { exts: ['.jpg', '.jpeg', '.png', '.webp'],                                    maxMB: 5,   contentType: 'image/*'       },
  portfolio:   { exts: ['.jpg', '.jpeg', '.png', '.pdf', '.mp4'],                             maxMB: 50,  contentType: '*/*'           },
  deliverable: { exts: ['.jpg', '.jpeg', '.png', '.pdf', '.psd', '.ai', '.zip', '.mp4', '.docx', '.xlsx', '.pptx'], maxMB: 200, contentType: '*/*' },
  id_card:     { exts: ['.jpg', '.jpeg', '.png'],                                             maxMB: 10,  contentType: 'image/*'       },
  license:     { exts: ['.jpg', '.jpeg', '.png', '.pdf'],                                     maxMB: 10,  contentType: '*/*'           },
  // W8 新增：IM 图片/文件
  im_image:    { exts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],                            maxMB: 20,  contentType: 'image/*'       },
  im_file:     { exts: ['.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.txt', '.mp4', '.mp3'],  maxMB: 100, contentType: '*/*'           },
};

export interface PresignResult {
  uploadUrl: string;
  fileUrl:   string;
  cdnUrl:    string;
  key:       string;
  expiresIn: number;
  method:    'PUT';
  /** 前端直传时需携带的请求头（Content-Type 必须与签名一致） */
  headers:   Record<string, string>;
}

@Injectable()
export class OssService implements OnModuleInit {
  private readonly logger = new Logger(OssService.name);
  private client!: OSSClient;
  private readonly isDev: boolean;
  private readonly bucket: string;
  private readonly region: string;
  private readonly cdnDomain: string;
  private readonly ossEndpoint: string;

  constructor(private readonly config: ConfigService) {
    this.isDev      = config.get<string>('NODE_ENV') !== 'production';
    this.bucket     = config.get<string>('OSS_BUCKET', 'wecreator-dev');
    this.region     = config.get<string>('OSS_REGION', 'oss-cn-hangzhou');
    this.cdnDomain  = config.get<string>('OSS_CDN_DOMAIN', '');
    this.ossEndpoint = `https://${this.bucket}.${this.region}.aliyuncs.com`;
  }

  onModuleInit() {
    const ak = this.config.get<string>('OSS_ACCESS_KEY', '');
    const sk = this.config.get<string>('OSS_SECRET', '');

    if (!ak || ak === 'test_key') {
      this.logger.warn('⚠️  OSS_ACCESS_KEY 未配置或为测试值，OSS 预签名使用 MOCK 模式');
      return;
    }

    try {
      this.client = new OSS({
        region:          this.region,
        accessKeyId:     ak,
        accessKeySecret: sk,
        bucket:          this.bucket,
        secure:          true,      // 强制 HTTPS
        timeout:         30000,
      });
      this.logger.log(`✅ OSS 客户端初始化成功: bucket=${this.bucket}, region=${this.region}`);
    } catch (e: any) {
      this.logger.error(`❌ OSS 客户端初始化失败: ${e.message}`);
    }
  }

  // ================================================================
  // 核心：生成预签名 PUT URL（客户端直传）
  // ================================================================
  async presign(
    category: string,
    originalName: string,
    fileSize: number,
    userId: number,
  ): Promise<PresignResult> {
    // 1. 校验类别
    const rule = FILE_RULES[category];
    if (!rule) throw new BadRequestException(`不支持的文件类别: ${category}`);

    // 2. 校验扩展名
    const ext = extname(originalName).toLowerCase();
    if (!rule.exts.includes(ext)) {
      throw new BadRequestException(
        `${category} 不允许 ${ext} 格式，仅支持: ${rule.exts.join(', ')}`,
      );
    }

    // 3. 校验大小
    const maxBytes = rule.maxMB * 1024 * 1024;
    if (fileSize > maxBytes) {
      throw new BadRequestException(`文件过大，${category} 最大 ${rule.maxMB}MB`);
    }

    // 4. 生成唯一对象 Key：category/yyyymmdd/userId_randomHex.ext
    const dateDir = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand    = randomBytes(8).toString('hex');
    const key     = `${category}/${dateDir}/${userId}_${rand}${ext}`;

    // 5. 根据 ext 推断 Content-Type
    const contentType = this._extToContentType(ext);

    // 6. MOCK 模式（开发 / AK 未配置）
    if (!this.client) {
      return this._mockPresign(key, contentType);
    }

    // 7. 真实 OSS 预签名
    const uploadUrl = this.client.signatureUrl(key, {
      method:  'PUT',
      expires: 600,    // 10 分钟
      'Content-Type': contentType,
    });

    const fileUrl = this._buildFileUrl(key);
    const cdnUrl  = this._buildCdnUrl(key);

    this.logger.log(`OSS presign: category=${category}, key=${key}, user=${userId}`);

    return {
      uploadUrl,
      fileUrl,
      cdnUrl,
      key,
      expiresIn: 600,
      method:    'PUT',
      headers:   { 'Content-Type': contentType },
    };
  }

  // ================================================================
  // 生成只读访问 URL（CDN 或 OSS 源站）
  // ================================================================
  getAccessUrl(key: string, expiresIn = 3600): string {
    if (!this.client) return `https://oss.mock.wecreator.local/${key}`;
    return this.client.signatureUrl(key, { expires: expiresIn });
  }

  /** 通过文件 key 得到公开 CDN URL（Bucket 设为公读时使用） */
  getCdnUrl(key: string): string {
    return this._buildCdnUrl(key);
  }

  // ================================================================
  // 删除对象（提交失败回滚用）
  // ================================================================
  async deleteObject(key: string): Promise<void> {
    if (!this.client) {
      this.logger.log(`[MOCK] 跳过 OSS 删除: ${key}`);
      return;
    }
    try {
      await this.client.delete(key);
      this.logger.log(`OSS 删除成功: ${key}`);
    } catch (e: any) {
      this.logger.warn(`OSS 删除失败: ${key} - ${e.message}`);
    }
  }

  // ================================================================
  // 是否已配置真实 OSS（供其他模块检查）
  // ================================================================
  isConfigured(): boolean {
    return !!this.client;
  }

  // ── Private Helpers ──────────────────────────────────────────────

  private _buildFileUrl(key: string): string {
    return `${this.ossEndpoint}/${key}`;
  }

  private _buildCdnUrl(key: string): string {
    if (this.cdnDomain) return `https://${this.cdnDomain}/${key}`;
    return this._buildFileUrl(key);
  }

  private _mockPresign(key: string, contentType: string): PresignResult {
    const base = 'https://oss.mock.wecreator.local';
    return {
      uploadUrl: `${base}/${key}?presign=mock&expires=600`,
      fileUrl:   `${base}/${key}`,
      cdnUrl:    `${base}/${key}`,
      key,
      expiresIn: 600,
      method:    'PUT',
      headers:   { 'Content-Type': contentType },
    };
  }

  private _extToContentType(ext: string): string {
    const map: Record<string, string> = {
      '.jpg':  'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png':  'image/png',
      '.gif':  'image/gif',
      '.webp': 'image/webp',
      '.pdf':  'application/pdf',
      '.mp4':  'video/mp4',
      '.mp3':  'audio/mpeg',
      '.psd':  'image/vnd.adobe.photoshop',
      '.ai':   'application/postscript',
      '.zip':  'application/zip',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.txt':  'text/plain',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
