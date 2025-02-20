<template>
  <div class="file-list-block">
    <h3>知识库文件详情</h3>
    <div class="file-chunks">
      <div v-if="!hasChunks" class="empty-state">
        暂无文件，请先上传文件
      </div>
      <div v-else v-for="(chunks, fileName) in groupedChunks" 
           :key="fileName" 
           class="file-group">
        <div class="file-header" @click="toggleFile(fileName)">
          <span class="file-name">{{ fileName }}</span>
          <span class="chunk-count">({{ chunks.length }} 个片段)</span>
          <span class="expand-icon">
            {{ isExpanded(fileName) ? '▼' : '▶' }}
          </span>
        </div>
        
        <div v-if="isExpanded(fileName)" class="chunk-list">
          <div v-for="chunk in chunks" 
               :key="chunk.id" 
               class="chunk-item">
            <div class="chunk-header">
              <span class="chunk-id">片段 {{ chunk.id.split('-').pop() }}</span>
              <span class="chunk-length">({{ chunk.content.length }} 字符)</span>
            </div>
            <p class="chunk-preview">{{ getPreview(chunk) }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FileList',
  props: {
    chunks: {
      type: Array,
      required: true,
      default: () => []
    }
  },
  data() {
    return {
      expandedFiles: new Set()
    }
  },
  computed: {
    hasChunks() {
      return this.chunks && this.chunks.length > 0
    },
    groupedChunks() {
      return this.chunks.reduce((groups, chunk) => {
        const fileName = chunk.title
        if (!groups[fileName]) {
          groups[fileName] = []
        }
        groups[fileName].push(chunk)
        return groups
      }, {})
    }
  },
  methods: {
    toggleFile(fileName) {
      if (this.expandedFiles.has(fileName)) {
        this.expandedFiles.delete(fileName)
      } else {
        this.expandedFiles.add(fileName)
      }
    },
    
    isExpanded(fileName) {
      return this.expandedFiles.has(fileName)
    },
    
    getPreview(chunk) {
      const maxLength = 200
      const content = chunk.content
      if (content.length <= maxLength) {
        return content
      }
      return content.slice(0, maxLength) + '...'
    }
  }
}
</script>

<style scoped>
.file-list-block {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: white;
}

.file-list-block h3 {
  margin: 0;
  padding: 15px;
  font-size: 1.1em;
  color: #333;
  border-bottom: 1px solid #eee;
  background: white;
}

.file-chunks {
  flex: 1;
  overflow-y: auto;
  padding: 15px;
  background: #f8f9fa;
}

.empty-state {
  text-align: center;
  color: #666;
  padding: 30px;
  font-style: italic;
}

.file-group {
  background: white;
  border: 1px solid #eee;
  border-radius: 6px;
  margin-bottom: 15px;
}

.file-header {
  padding: 12px 15px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #fff;
  border-bottom: 1px solid #eee;
}

.file-name {
  font-weight: 500;
  color: #2c3e50;
}

.chunk-count {
  color: #666;
  font-size: 0.9em;
}

.chunk-list {
  padding: 10px 15px;
  background: #fff;
}

.chunk-item {
  padding: 12px;
  border-bottom: 1px solid #eee;
}

.chunk-item:last-child {
  border-bottom: none;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  color: #666;
  font-size: 0.9em;
}

.chunk-preview {
  color: #333;
  line-height: 1.5;
  margin: 0;
}

/* 滚动条样式 */
.file-chunks::-webkit-scrollbar {
  width: 6px;
}

.file-chunks::-webkit-scrollbar-track {
  background: transparent;
}

.file-chunks::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

.file-chunks::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style> 