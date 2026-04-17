import { useState, useEffect, useCallback } from 'react'
import { View, Text, Image, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

interface WorkItem {
  id: string
  url: string
  name: string
  addedAt: string
}

const STORAGE_KEY = 'wc_portfolio'

function loadPortfolio(): WorkItem[] {
  try {
    const raw = Taro.getStorageSync(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function savePortfolio(items: WorkItem[]) {
  Taro.setStorageSync(STORAGE_KEY, JSON.stringify(items))
}

export default function PortfolioPage() {
  const [items, setItems] = useState<WorkItem[]>(loadPortfolio())
  const [previewing, setPreviewing] = useState(false)

  // 添加作品
  const handleAdd = useCallback(async () => {
    try {
      const res = await Taro.chooseImage({
        count: 9,
        sourceType: ['album', 'camera'],
      })

      const newItems: WorkItem[] = res.tempFilePaths.map((path, i) => ({
        id: `${Date.now()}_${i}`,
        url: path,
        name: `作品_${items.length + i + 1}`,
        addedAt: new Date().toISOString(),
      }))

      const updated = [...items, ...newItems]
      setItems(updated)
      savePortfolio(updated)
      Taro.showToast({ title: `已添加 ${newItems.length} 张`, icon: 'success' })
    } catch {
      // 用户取消
    }
  }, [items])

  // 预览
  const handlePreview = useCallback((url: string) => {
    setPreviewing(true)
    Taro.previewImage({
      current: url,
      urls: items.map(i => i.url),
      complete: () => setPreviewing(false),
    })
  }, [items])

  // 删除
  const handleDelete = useCallback((id: string) => {
    Taro.showModal({
      title: '删除作品',
      content: '确定删除这张作品？',
      confirmColor: '#ff4d4f',
    }).then(({ confirm }) => {
      if (confirm) {
        const updated = items.filter(i => i.id !== id)
        setItems(updated)
        savePortfolio(updated)
      }
    })
  }, [items])

  return (
    <View className='page'>
      <View className='header'>
        <Text className='title'>作品集</Text>
        <Text className='count'>{items.length} 张作品</Text>
      </View>

      <ScrollView className='grid-scroll' scrollY>
        <View className='grid'>
          {/* 添加按钮 */}
          <View className='add-card' onClick={handleAdd}>
            <Text className='add-icon'>+</Text>
            <Text className='add-text'>添加作品</Text>
          </View>

          {/* 作品列表 */}
          {items.map(item => (
            <View key={item.id} className='work-card'>
              <Image
                className='work-img'
                src={item.url}
                mode='aspectFill'
                onClick={() => handlePreview(item.url)}
              />
              <View className='work-info'>
                <Text className='work-name'>{item.name}</Text>
              </View>
              <View className='delete-btn' onClick={() => handleDelete(item.id)}>
                <Text className='delete-icon'>×</Text>
              </View>
            </View>
          ))}
        </View>

        {items.length === 0 && (
          <View className='empty'>
            <Text className='empty-icon'>🖼️</Text>
            <Text className='empty-text'>还没有作品</Text>
            <Text className='empty-hint'>上传您的设计/摄影/文案等作品，提升被邀约几率</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}
