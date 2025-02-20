<template>
  <div class="upload-section">
    <div class="upload-header">
      <h3>上传文件</h3>
      <div class="supported-types">
        支持的文件类型: .txt, .md, .pdf, .doc, .docx, .xls, .xlsx
      </div>
    </div>

    <div class="upload-area" 
         :class="{ dragging: isDragging }"
         @dragenter.prevent="isDragging = true"
         @dragover.prevent="isDragging = true"
         @dragleave.prevent="isDragging = false"
         @drop.prevent="handleDrop">
      <input 
        type="file" 
        ref="fileInput"
        @change="handleFileSelect"
        multiple
        accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx"
        style="display: none"
      >
      
      <div class="upload-content">
        <div class="upload-icon">
          <span v-if="isProcessing">⏳</span>
          <span v-else>📄</span>
        </div>
        <div class="upload-text">
          <template v-if="!isProcessing">
            拖放文件到此处，或
            <button class="browse-btn" @click="triggerFileInput">
              浏览文件
            </button>
          </template>
          <template v-else>
            <div class="processing-status">
              正在处理文件 {{ status.processedFiles + 1 }}/{{ status.totalFiles }}
              <div class="progress-bar">
                <div class="progress" :style="{ width: status.progress + '%' }"></div>
              </div>
              <div class="chunk-progress" v-if="status.totalChunks">
                处理片段: {{ status.currentChunk }}/{{ status.totalChunks }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="uploadedFiles.length > 0" class="file-list">
      <div v-for="file in uploadedFiles" 
           :key="file.name" 
           class="file-item">
        <div class="file-info">
          <span class="file-icon">{{ getFileIcon(file) }}</span>
          <span class="file-name">{{ file.name }}</span>
          <span class="file-type">{{ getFileTypeLabel(file) }}</span>
        </div>
        <div class="file-size">{{ formatFileSize(file.size) }}</div>
      </div>
    </div>
  </div>
</template>

<script>
import { processFile } from '@/utils/fileProcessor'

export default {
  name: 'FileUpload',
  props: {
    endpoint: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isDragging: false,
      isProcessing: false,
      uploadedFiles: [],
      status: {
        totalFiles: 0,
        processedFiles: 0,
        totalChunks: 0,
        currentChunk: 0,
        progress: 0
      }
    }
  },
  methods: {
    triggerFileInput() {
      this.$refs.fileInput.click()
    },
    
    handleDrop(e) {
      this.isDragging = false
      const files = [...e.dataTransfer.files]
      this.processFiles(files)
    },
    
    handleFileSelect(e) {
      const files = [...e.target.files]
      this.processFiles(files)
    },
    
    async processFiles(files) {
      if (this.isProcessing) return
      
      this.isProcessing = true
      this.status = {
        totalFiles: files.length,
        processedFiles: 0,
        totalChunks: 0,
        currentChunk: 0,
        progress: 0
      }
      
      const results = []
      
      try {
        for (const file of files) {
          // 验证文件类型
          if (!this.isValidFileType(file)) {
            this.$emit('toast', `不支持的文件类型: ${file.name}`, 'error')
            continue
          }
          
          // 添加到上传列表
          this.uploadedFiles.push(file)
          
          // 处理文件
          const chunks = await processFile(file, this.endpoint, this.status)
          results.push(...chunks)
          
          this.status.processedFiles++
        }
        
        // 发送处理结果
        this.$emit('processed', {
          success: results,
          failed: []
        })
        this.$emit('toast', '文件处理完成', 'success')
        
      } catch (error) {
        console.error('处理文件失败:', error)
        this.$emit('toast', `处理文件失败: ${error.message}`, 'error')
      } finally {
        this.isProcessing = false
        this.status.progress = 100
      }
    },
    
    isValidFileType(file) {
      const validTypes = [
        'text/plain',
        'text/markdown',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ]
      
      // 检查 MIME 类型
      if (validTypes.includes(file.type)) return true
      
      // 检查文件扩展名
      const ext = file.name.toLowerCase().split('.').pop()
      return ['txt', 'md', 'pdf', 'doc', 'docx', 'xls', 'xlsx'].includes(ext)
    },
    
    getFileTypeLabel(file) {
      const ext = file.name.toLowerCase().split('.').pop()
      const typeMap = {
        txt: '文本文件',
        md: 'Markdown',
        pdf: 'PDF文档',
        doc: 'Word文档',
        docx: 'Word文档',
        xls: 'Excel表格',
        xlsx: 'Excel表格'
      }
      return typeMap[ext] || '未知类型'
    },
    
    getFileIcon(file) {
      const ext = file.name.toLowerCase().split('.').pop()
      const iconMap = {
        txt: '📝',
        md: '📑',
        pdf: '📄',
        doc: '📰',
        docx: '📰',
        xls: '📊',
        xlsx: '📊'
      }
      return iconMap[ext] || '📄'
    },
    
    formatFileSize(bytes) {
      if (bytes === 0) return '0 B'
      const k = 1024
      const sizes = ['B', 'KB', 'MB', 'GB']
      const i = Math.floor(Math.log(bytes) / Math.log(k))
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }
  }
}
</script>

<style scoped>
.upload-section {
  padding: 15px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.upload-header {
  margin-bottom: 15px;
}

.upload-header h3 {
  margin: 0 0 8px 0;
  font-size: 1.1em;
  color: #333;
}

.supported-types {
  font-size: 0.9em;
  color: #666;
}

.upload-area {
  border: 2px dashed #ddd;
  border-radius: 8px;
  padding: 30px;
  text-align: center;
  transition: all 0.3s ease;
  background: #f8f9fa;
  cursor: pointer;
}

.upload-area.dragging {
  border-color: #4CAF50;
  background: #f1f8e9;
}

.upload-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 15px;
}

.upload-icon {
  font-size: 40px;
  color: #666;
}

.upload-text {
  color: #666;
  font-size: 1em;
}

.browse-btn {
  background: none;
  border: none;
  color: #4CAF50;
  cursor: pointer;
  padding: 0;
  font: inherit;
  text-decoration: underline;
}

.processing-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  width: 200px;
  height: 6px;
  background: #eee;
  border-radius: 3px;
  overflow: hidden;
}

.progress {
  height: 100%;
  background: #4CAF50;
  transition: width 0.3s ease;
}

.chunk-progress {
  font-size: 0.9em;
  color: #666;
}

.file-list {
  margin-top: 20px;
  border-top: 1px solid #eee;
  padding-top: 15px;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
}

.file-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-icon {
  font-size: 1.2em;
  margin-right: 8px;
}

.file-name {
  color: #333;
}

.file-type {
  color: #666;
  font-size: 0.9em;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.file-size {
  color: #666;
  font-size: 0.9em;
}
</style> 