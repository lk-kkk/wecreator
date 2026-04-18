import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

/**
 * AES-256-CBC 加密工具
 *
 * R9 P1-01 修复：每次加密使用随机 IV，格式 = `iv_hex:ciphertext_hex`
 * 向后兼容：解密时自动检测是否含 `:` 分隔符，若无则使用环境变量中的固定 IV（旧数据）
 */
@Injectable()
export class CryptoUtil {
  private readonly key: Buffer;
  private readonly legacyIv: Buffer; // 旧版固定 IV（向后兼容）

  constructor(private readonly config: ConfigService) {
    const keyStr = config.get<string>('AES_KEY', '');
    if (!keyStr || keyStr.length !== 32) {
      throw new Error('[FATAL] AES_KEY 未配置或长度不等于 32 字节');
    }
    this.key = Buffer.from(keyStr, 'utf-8');
    this.legacyIv = Buffer.from(
      config.get<string>('AES_IV', '0000000000000000'),
      'utf-8',
    );
  }

  /**
   * AES-256-CBC 加密（随机 IV）
   * 输出格式: `iv_hex:ciphertext_hex`
   */
  encrypt(plainText: string): string {
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.key, iv);
    let encrypted = cipher.update(plainText, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  }

  /**
   * AES-256-CBC 解密（向后兼容）
   * - 新格式: `iv_hex:ciphertext_hex` → 提取 IV 解密
   * - 旧格式: `ciphertext_hex` → 使用固定 IV 解密
   */
  decrypt(encryptedText: string): string {
    let iv: Buffer;
    let ciphertext: string;

    if (encryptedText.includes(':')) {
      // 新格式：随机 IV
      const parts = encryptedText.split(':');
      iv = Buffer.from(parts[0], 'hex');
      ciphertext = parts[1];
    } else {
      // 旧格式：固定 IV（向后兼容）
      iv = this.legacyIv;
      ciphertext = encryptedText;
    }

    const decipher = createDecipheriv('aes-256-cbc', this.key, iv);
    let decrypted = decipher.update(ciphertext, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
