<template>
  <div class="oss-uploader">
    <a-upload
      :accept="acceptStr"
      :before-upload="handleBeforeUpload"
      :show-upload-list="false"
      :disabled="uploading"
      :multiple="multiple"
    >
      <!-- 图片预览模式 -->
      <div v-if="mode === 'avatar'" class="avatar-trigger">
        <img v-if="previewUrl" :src="previewUrl" class="avatar-preview" />
        <div v-else class="avatar-placeholder">
          <span class="avatar-icon">+</span>
        </div>
        <div v-if="uploading" class="avatar-mask">
          <a-progress :percent="progress" :show-info="false" size="small" />
        </div>
      </div>

      <!-- 拖拽上传模式（交付物/文件） -->
      <div v-else-if="mode === 'dragger'" class="dragger-area">
        <div v-if="uploading" class="dragger-progress">
          <a-progress :percent="progress" />
          <span class="prog-text">上传中 {{ progress }}%</span>
        </div>
        <div v-else>
          <p class="dragger-icon">📁</p>
          <p class="dragger-hint">点击或将文件拖拽到这里上传</p>
          <p class="dragger-note">支持：{{ rule?.allowedExts.join(', ') }}，最大 {{ rule?.maxSizeMB }}MB</p>
        </div>
      </div>

      <!-- 默认按钮模式 -->
      <a-button v-else :loading="uploading" :disabled="uploading">
        <span v-if="!uploading">📎 {{ buttonText }}</span>
        <span v-else>上传中 {{ progress }}%</span>
      </a-button>
    </a-upload>

    <!-- 已上传文件列表（多文件模式） -->
    <div v-if="uploadedFiles.length > 0 && showList" class="file-list">
      <div v-for="(f, i) in uploadedFiles" :key="i" class="file-item">
        <span class="file-icon">{{ getFileIcon(f.name) }}</span>
        <span class="file-name">{{ f.name }}</span>
        <span class="file-size">{{ formatSize(f.size) }}</span>
        <a :href="f.cdnUrl" target="_blank" class="file-link">查看</a>
        <a-button size="small" type="text" danger @click="removeFile(i)">删除</a-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { message } from 'ant-design-vue'
import { uploadToOss, type UploadCategory } from '@/api/oss'

interface Props {
  category:    UploadCategory
  mode?:       'button' | 'avatar' | 'dragger'
  multiple?:   boolean
  showList?:   boolean
  buttonText?: string
  maxCount?:   number
}

interface UploadedFile {
  name:    string
  size:    number
  key:     string
  fileUrl: string
  cdnUrl:  string
}

const props = withDefaults(defineProps<Props>(), {
  mode:       'button',
  multiple:   false,
  showList:   true,
  buttonText: '上传文件',
  maxCount:   10,
})

const emit = defineEmits<{
  /** 单文件上传完成 */
  uploaded:   [result: UploadedFile]
  /** 多文件列表变更 */
  listChange: [files: UploadedFile[]]
}>()

const uploading    = ref(false)
const progress     = ref(0)
const previewUrl   = ref('')
const uploadedFiles = ref<UploadedFile[]>([])

// 规则查询
const RULES: Record<string, { allowedExts: string[]; maxSizeMB: number }> = {
  avatar:      { allowedExts: ['.jpg', '.jpeg', '.png', '.webp'],                    maxSizeMB: 5   },
  portfolio:   { allowedExts: ['.jpg', '.jpeg', '.png', '.pdf', '.mp4'],             maxSizeMB: 50  },
  deliverable: { allowedExts: ['.jpg', '.jpeg', '.png', '.pdf', '.psd', '.ai', '.zip', '.mp4', '.docx', '.xlsx', '.pptx'], maxSizeMB: 200 },
  id_card:     { allowedExts: ['.jpg', '.jpeg', '.png'],                             maxSizeMB: 10  },
  license:     { allowedExts: ['.jpg', '.jpeg', '.png', '.pdf'],                     maxSizeMB: 10  },
  im_image:    { allowedExts: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],            maxSizeMB: 20  },
  im_file:     { allowedExts: ['.pdf', '.docx', '.xlsx', '.pptx', '.zip', '.txt', '.mp4', '.mp3'], maxSizeMB: 100 },
}

const rule = computed(() => RULES[props.category])
const acceptStr = computed(() => rule.value?.allowedExts.join(',') ?? '*')

async function handleBeforeUpload(file: File) {
  if (uploadedFiles.value.length >= props.maxCount!) {
    message.warning(`最多上传 ${props.maxCount} 个文件`)
    return false
  }

  uploading.value = true
  progress.value  = 0

  try {
    const result = await uploadToOss({
      category:   props.category,
      file,
      onProgress: (p) => { progress.value = p },
    })

    const uploaded: UploadedFile = {
      name:    file.name,
      size:    file.size,
      key:     result.key,
      fileUrl: result.fileUrl,
      cdnUrl:  result.cdnUrl,
    }

    // 头像模式：本地预览
    if (props.mode === 'avatar') {
      previewUrl.value = URL.createObjectURL(file)
    }

    if (props.multiple) {
      uploadedFiles.value.push(uploaded)
      emit('listChange', uploadedFiles.value)
    }
    emit('uploaded', uploaded)
    message.success('上传成功 ✅')
  } catch (e: any) {
    message.error(e?.response?.data?.message || '上传失败')
  } finally {
    uploading.value = false
    progress.value  = 0
  }

  return false // 阻止 ant-design 默认上传行为
}

function removeFile(idx: number) {
  uploadedFiles.value.splice(idx, 1)
  emit('listChange', uploadedFiles.value)
}

const formatSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

const getFileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  const icons: Record<string, string> = {
    pdf: '📄', jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️',
    zip: '🗜️', mp4: '🎥', mp3: '🎵', docx: '📝', xlsx: '📊', pptx: '📑',
  }
  return icons[ext ?? ''] ?? '📎'
}

/** 暴露给父组件：重置状态 */
defineExpose({ reset: () => { uploadedFiles.value = []; previewUrl.value = '' } })
</script>

<style scoped>
.oss-uploader { width: 100%; }

/* 头像模式 */
.avatar-trigger {
  position: relative; width: 80px; height: 80px; cursor: pointer;
}
.avatar-preview {
  width: 80px; height: 80px; border-radius: 50%; object-fit: cover;
  border: 2px solid var(--color-border);
}
.avatar-placeholder {
  width: 80px; height: 80px; border-radius: 50%;
  border: 2px dashed var(--color-border); display: flex; align-items: center;
  justify-content: center; background: var(--color-bg-hover);
}
.avatar-icon { font-size: 24px; color: #999; }
.avatar-mask {
  position: absolute; inset: 0; border-radius: 50%;
  background: rgba(0,0,0,.5); display: flex; align-items: center; justify-content: center;
}

/* 拖拽模式 */
.dragger-area {
  padding: 24px; border: 2px dashed var(--color-border); border-radius: 8px;
  background: var(--color-bg-hover); text-align: center; cursor: pointer;
  transition: border-color .2s;
}
.dragger-area:hover { border-color: var(--color-primary); }
.dragger-icon  { font-size: 32px; margin: 0 0 8px; }
.dragger-hint  { font-size: 14px; color: #555; margin: 0 0 4px; }
.dragger-note  { font-size: 12px; color: #aaa; margin: 0; }
.dragger-progress { padding: 8px 0; }
.prog-text { font-size: 13px; color: var(--color-primary); display: block; margin-top: 8px; }

/* 文件列表 */
.file-list { margin-top: 12px; display: flex; flex-direction: column; gap: 6px; }
.file-item {
  display: flex; align-items: center; gap: 8px; padding: 6px 10px;
  background: var(--color-bg-hover); border-radius: 6px; border: 1px solid #f0f0f0;
  font-size: 13px;
}
.file-icon { font-size: 16px; }
.file-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #333; }
.file-size { color: #aaa; font-size: 12px; white-space: nowrap; }
.file-link { color: var(--color-primary); font-size: 12px; white-space: nowrap; }
</style>
