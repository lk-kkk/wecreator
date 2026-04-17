/**
 * OSS 客户端直传工具
 *
 * 使用流程：
 *   1. 调用后端 POST /api/v1/common/upload/presign 获取预签名 URL
 *   2. 用 axios PUT 直接上传到 OSS（不经过应用服务器）
 *   3. 返回 fileUrl / key 供业务接口保存
 */
import axios from 'axios'
import request from './request'

export interface UploadResult {
  key:     string
  fileUrl: string
  cdnUrl:  string
}

export type UploadCategory =
  | 'avatar'
  | 'portfolio'
  | 'deliverable'
  | 'id_card'
  | 'license'
  | 'im_image'
  | 'im_file'

export interface UploadOptions {
  category:   UploadCategory
  file:       File
  /** 上传进度回调 0-100 */
  onProgress?: (percent: number) => void
}

/**
 * 通用 OSS 直传
 */
export async function uploadToOss(opts: UploadOptions): Promise<UploadResult> {
  const { category, file, onProgress } = opts

  // Step 1: 获取预签名 URL
  const presignRes = await request.post('/common/upload/presign', {
    category,
    originalName: file.name,
    fileSize:     file.size,
  })

  const { uploadUrl, fileUrl, cdnUrl, key, headers } = presignRes.data

  // Step 2: PUT 直传到 OSS
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': headers?.['Content-Type'] ?? file.type,
    },
    onUploadProgress: (evt) => {
      if (evt.total && onProgress) {
        onProgress(Math.round((evt.loaded / evt.total) * 100))
      }
    },
  })

  return { key, fileUrl, cdnUrl }
}

/**
 * 头像上传
 */
export const uploadAvatar = (file: File, onProgress?: (p: number) => void) =>
  uploadToOss({ category: 'avatar', file, onProgress })

/**
 * 交付物上传
 */
export const uploadDeliverable = (file: File, onProgress?: (p: number) => void) =>
  uploadToOss({ category: 'deliverable', file, onProgress })

/**
 * IM 图片上传
 */
export const uploadImImage = (file: File, onProgress?: (p: number) => void) =>
  uploadToOss({ category: 'im_image', file, onProgress })

/**
 * IM 文件上传
 */
export const uploadImFile = (file: File, onProgress?: (p: number) => void) =>
  uploadToOss({ category: 'im_file', file, onProgress })

/**
 * 营业执照上传
 */
export const uploadLicense = (file: File, onProgress?: (p: number) => void) =>
  uploadToOss({ category: 'license', file, onProgress })

// ── 开发模式提示 ────────────────────────────────────────────────────
/**
 * 检查 OSS 配置状态（运维诊断用）
 */
export async function checkOssStatus(): Promise<{
  configured: boolean
  note: string
}> {
  const res = await request.get('/common/upload/oss-status')
  return res.data
}
