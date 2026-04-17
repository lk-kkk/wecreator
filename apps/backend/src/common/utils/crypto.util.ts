import { createCipheriv, createDecipheriv } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CryptoUtil {
  private readonly key: Buffer;
  private readonly iv: Buffer;

  constructor(private readonly config: ConfigService) {
    this.key = Buffer.from(config.get<string>('AES_KEY', ''), 'utf-8');
    this.iv = Buffer.from(config.get<string>('AES_IV', ''), 'utf-8');
  }

  /**
   * AES-256-CBC 加密
   * 用于手机号、身份证号等敏感字段
   */
  encrypt(plainText: string): string {
    const cipher = createCipheriv('aes-256-cbc', this.key, this.iv);
    let encrypted = cipher.update(plainText, 'utf-8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }

  /**
   * AES-256-CBC 解密
   */
  decrypt(encryptedText: string): string {
    const decipher = createDecipheriv('aes-256-cbc', this.key, this.iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf-8');
    decrypted += decipher.final('utf-8');
    return decrypted;
  }
}
