import { Injectable, Logger } from '@nestjs/common';
import { OssService, FILE_RULES } from './oss.service';

@Injectable()
export class FileService {
  private readonly logger = new Logger(FileService.name);

  constructor(private readonly ossService: OssService) {}

  // ================================================================
  // 获取预签名上传 URL（委托给 OssService）
  // ================================================================
  async getPresignUrl(
    category: string,
    originalName: string,
    fileSize: number,
    userId = 0,
  ) {
    const result = await this.ossService.presign(category, originalName, fileSize, userId);
    this.logger.log(`Presign issued: category=${category}, key=${result.key}`);
    return result;
  }

  // ================================================================
  // 文件校验规则（供前端动态查询）
  // ================================================================
  getFileRules() {
    return Object.entries(FILE_RULES).map(([category, rule]) => ({
      category,
      allowedExts: rule.exts,
      maxSizeMB:   rule.maxMB,
    }));
  }

  // ================================================================
  // 通过 key 获取 CDN/OSS 公开访问 URL
  // ================================================================
  getAccessUrl(key: string): string {
    return this.ossService.getAccessUrl(key);
  }

  getCdnUrl(key: string): string {
    return this.ossService.getCdnUrl(key);
  }

  // ================================================================
  // OSS 配置状态（诊断用）
  // ================================================================
  getOssStatus() {
    return {
      configured: this.ossService.isConfigured(),
      note:       this.ossService.isConfigured()
        ? '阿里云 OSS 已配置，客户端直传已就绪'
        : '开发 MOCK 模式：预签名 URL 为占位符，实际不可直传',
    };
  }
}
