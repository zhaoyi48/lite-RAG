<template>
  <div class="knowledge-base">
    <!-- 设置部分 -->
    <OllamaSettings
      :endpoint="ollamaEndpoint"
      @update:endpoint="updateEndpoint"
      @models-updated="updateModels"
      @toast="showToast"
    />
    
    <div class="main-content">
      <!-- 知识库部分 -->
      <div class="knowledge-section">
        <div class="knowledge-header">
          <FileUpload
            :endpoint="ollamaEndpoint"
            @processed="handleUploadComplete"
            @toast="showToast"
          />
          
          <KnowledgeStats
            :stats="fileStats"
          />
        </div>
        
        <div class="knowledge-body">
          <KnowledgeSearch
            :vectors="vectors"
            :endpoint="ollamaEndpoint"
            @toast="showToast"
          />
          
          <FileList
            :chunks="vectors"
          />
        </div>
      </div>
      
      <!-- 聊天部分 -->
      <ChatWindow
        :vectors="vectors"
        :endpoint="ollamaEndpoint"
        :models="availableModels"
        @toast="showToast"
      />
    </div>
    
    <!-- 提示信息 -->
    <Toast
      :show="toast.show"
      :message="toast.message"
      :type="toast.type"
      @close="hideToast"
    />
  </div>
</template>

<script>
import OllamaSettings from './components/settings/OllamaSettings.vue'
import FileUpload from '@/components/files/FileUpload.vue'
import KnowledgeStats from './components/stats/KnowledgeStats.vue'
import KnowledgeSearch from './components/search/KnowledgeSearch.vue'
import FileList from './components/files/FileList.vue'
import ChatWindow from './components/chat/ChatWindow.vue'
import Toast from './components/common/Toast.vue'

export default {
  name: 'App',
  components: {
    OllamaSettings,
    FileUpload,
    KnowledgeStats,
    KnowledgeSearch,
    FileList,
    ChatWindow,
    Toast
  },
  data() {
    return {
      ollamaEndpoint: localStorage.getItem('ollamaEndpoint') || 'http://127.0.0.1:11434',
      vectors: [],
      availableModels: [],
      toast: {
        show: false,
        message: '',
        type: 'info'
      }
    }
  },
  computed: {
    fileStats() {
      const uniqueFiles = new Set(this.vectors.map(v => v.title))
      const totalCharacters = this.vectors.reduce((sum, v) => sum + v.content.length, 0)
      
      return {
        totalFiles: uniqueFiles.size,
        totalChunks: this.vectors.length,
        vectorDimension: this.vectors[0]?.vector?.length || 0,
        totalCharacters
      }
    }
  },
  methods: {
    updateEndpoint(endpoint) {
      this.ollamaEndpoint = endpoint
      localStorage.setItem('ollamaEndpoint', endpoint)
    },
    
    updateModels(models) {
      this.availableModels = models
        .filter(model => model.name !== 'nomic-embed-text')
        .map(model => ({
          id: model.name,
          name: model.name
        }))
    },
    
    handleUploadComplete({ success, failed }) {
      if (!Array.isArray(this.vectors)) {
        this.vectors = []
      }
      
      this.vectors.push(...success)
      
      let message = `处理完成！\n共处理 ${success.length} 个文本片段`
      if (failed.length > 0) {
        message += `\n以下文件处理失败：\n${failed.join('\n')}`
      }
      
      this.showToast(message, failed.length > 0 ? 'error' : 'success')
    },
    
    showToast(message, type = 'info') {
      if (typeof message === 'object') {
        message = JSON.stringify(message)
      }
      
      this.toast = {
        show: true,
        message: message,
        type: type
      }
      
      setTimeout(() => {
        this.hideToast()
      }, 3000)
    },
    
    hideToast() {
      this.toast.show = false
    }
  }
}
</script>

<style>
/* 全局重置和基础样式 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen,
    Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  line-height: 1.6;
  color: #333;
  background-color: #f5f5f5;
}

/* 主布局样式 */
.knowledge-base {
  max-width: 1400px;
  margin: 0 auto;
  padding: 20px;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); /* 防止内容溢出 */
  gap: 20px;
  margin-top: 20px;
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 允许容器收缩 */
}

/* 知识库部分样式 */
.knowledge-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px); /* 减去头部和边距的高度 */
  min-height: 600px;
  overflow: hidden; /* 防止内容溢出 */
}

.knowledge-header {
  flex-shrink: 0;
}

.knowledge-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* 聊天部分样式 */
.chat-section {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  height: calc(100vh - 140px);
  min-height: 600px;
  overflow: hidden;
}

/* 通用组件样式 */
button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.3s;
}

button:hover {
  background-color: #45a049;
}

button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

input, select {
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

input:focus, select:focus {
  outline: none;
  border-color: #4CAF50;
}

/* 响应式布局 */
@media (max-width: 768px) {
  .main-content {
    grid-template-columns: 1fr;
  }
  
  .knowledge-base {
    padding: 10px;
  }
  
  .chat-section {
    height: 500px;
  }
}

/* 滚动条美化 */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>

