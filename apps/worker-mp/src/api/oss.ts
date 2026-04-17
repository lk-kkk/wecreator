/**
 * 小程序 OSS 直传工具
 *
 * 使用流程：
 *   1. 调用后端 POST /api/v1/common/upload/presign 获取预签名 PUT URL
 *   2. 使用 wx.uploadFile 或 wx.request 直传到 OSS
 *   3. 返回 { key, fileUrl, cdnUrl } 供业务接口保存
 */
import Taro from '@tarojs/taro'
import { request } from './request'

export type UploadCategory =
  | 'avatar'
  | 'portfolio'
  | 'deliverable'
  | 'id_card'
  | 'license'
  | 'im_image'
  | 'im_file'

export interface UploadResult {
  key:     string
  fileUrl: string
  cdnUrl:  string
}

/**
 * OSS 客户端直传（小程序端）
 *
 * @param category  文件类别
 * @param filePath  本地临时文件路径（Taro.chooseImage/chooseMessageFile 返回）
 * @param fileName  原始文件名（含扩展名），如 "photo.jpg"
 * @param fileSize  文件字节大小
 * @param onProgress 上传进度回调 0-100
 */
export async function uploadToOss(
  category: UploadCategory,
  filePath:  string,
  fileName:  string,
  fileSize:  number,
  onProgress?: (percent: number) => void,
): Promise<UploadResult> {
  // 1. 获取预签名 URL
  const presignRes: any = await request({
    url:    '/common/upload/presign',
    method: 'POST',
    data:   { category, originalName: fileName, fileSize },
  })

  const { uploadUrl, fileUrl, cdnUrl, key, headers } = presignRes.data
  const contentType: string = (headers?.['Content-Type'] as string) ?? 'application/octet-stream'

  // 2. 小程序端直传：使用 wx.uploadFile (multipart) 或 Taro.request (PUT binary)
  //    OSS 预签名 PUT 不支持 multipart，需使用 wx.request 的 arraybuffer 模式
  //    但小程序的 wx.request 不支持发 PUT + binary body，故使用 Taro.uploadFile 兼容
  //
  //    实际上阿里云 OSS 也支持 POST policy（表单上传），这里使用 uploadFile + PUT header
  await new Promise<void>((resolve, reject) => {
    const task = Taro.uploadFile({
      url:          uploadUrl,
      filePath,
      name:         'file',                       // OSS POST policy 中 file 字段
      header:       { 'Content-Type': contentType },
      success:      (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve()
        else reject(new Error(`OSS 上传失败: ${res.statusCode}`))
      },
      fail:         (err) => reject(new Error(err.errMsg || '上传失败')),
    })
    task.onProgressUpdate?.((evt) => {
      onProgress?.(evt.progress)
    })
  })

  return { key, fileUrl, cdnUrl }
}

/**
 * 选择图片并上传到 OSS
 */
export async function chooseAndUploadImage(
  category: UploadCategory = 'im_image',
  onProgress?: (p: number) => void,
): Promise<UploadResult & { tempPath: string }> {
  const res = await Taro.chooseImage({
    count:      1,
    sourceType: ['album', 'camera'],
  })
  const tempPath = res.tempFilePaths[0]

  // 获取文件信息（大小）
  const info = await new Promise<{ size: number }>((resolve, reject) => {
    Taro.getFileInfo({
      filePath: tempPath,
      success:  (r: any) => resolve({ size: r.size }),
      fail:     () => resolve({ size: 0 }),
    })
  })

  const ext = tempPath.split('.').pop() ?? 'jpg'
  const result = await uploadToOss(
    category,
    tempPath,
    `upload.${ext}`,
    info.size,
    onProgress,
  )

  return { ...result, tempPath }
}

/**
 * 选择文件并上传到 OSS（仅微信支持 chooseMessageFile）
 */
export async function chooseAndUploadFile(
  onProgress?: (p: number) => void,
): Promise<UploadResult & { tempPath: string; name: string }> {
  const res: any = await new Promise((resolve, reject) => {
    ;(Taro as any).chooseMessageFile?.({
      count: 1,
      type:  'file',
      success: resolve,
      fail:    reject,
    }) ?? reject(new Error('当前环境不支持选择文件'))
  })

  const file = res.tempFiles[0]
  const result = await uploadToOss(
    'im_file',
    file.path,
    file.name,
    file.size,
    onProgress,
  )

  return { ...result, tempPath: file.path, name: file.name }
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024)           return `${bytes}B`
  if (bytes < 1024 * 1024)   return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

/**
 * 根据文件名获取 Emoji 图标
 */
export function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const m: Record<string, string> = {
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    pdf: '📄', docx: '📝', xlsx: '📊', pptx: '📑',
    zip: '🗜️', mp4: '🎥', mp3: '🎵', txt: '📃',
  }
  return m[ext] ?? '📎'
}
