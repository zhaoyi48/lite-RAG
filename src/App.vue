<template>
  <div class="knowledge-base">
    <div class="settings-section">
      <div class="setting-item">
        <label>Ollama 服务地址：</label>
        <input 
          type="text" 
          v-model="ollamaEndpoint"
          placeholder="例如：http://127.0.0.1:11434"
        >
        <button @click="testConnection">测试连接</button>
      </div>
    </div>

    <div class="main-content">
      <!-- 左侧知识库部分 -->
      <div class="knowledge-section">
        <h2>知识库管理</h2>
        
        <!-- 上传文件部分 -->
        <div class="upload-block">
          <h3>文件上传</h3>
          <div class="upload-section">
            <input type="file" @change="handleFileUpload" multiple accept=".txt,.md">
            <div class="supported-formats">
              支持的格式：TXT, MD
            </div>
            <div class="upload-status" v-if="uploadStatus.isUploading">
              <div class="progress-bar">
                <div class="progress" :style="{ width: uploadStatus.progress + '%' }"></div>
              </div>
              <div class="status-text">
                正在处理: {{ uploadStatus.currentFile }}
                <span class="detail">{{ uploadStatus.currentChunk }}/{{ uploadStatus.totalChunks }} 片段</span>
              </div>
            </div>
            <button 
              @click="uploadFiles" 
              :disabled="uploadStatus.isUploading"
            >
              {{ uploadStatus.isUploading ? '处理中...' : '上传文件' }}
            </button>
          </div>
        </div>

        <!-- 搜索部分 -->
        <div class="search-block">
          <h3>知识库搜索</h3>
          <div class="search-section">
            <div class="search-input-wrapper">
              <input 
                type="text" 
                v-model="searchQuery" 
                placeholder="输入搜索关键词"
                @keyup.enter="searchDocuments"
              >
              <button @click="searchDocuments">搜索</button>
            </div>
            <div class="results-section">
              <div v-for="(result, index) in searchResults" :key="index" class="result-item">
                <h4>{{ result.title }}</h4>
                <p>{{ result.content }}</p>
                <p class="similarity">相似度: {{ result.similarity }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- 添加知识库统计信息 -->
        <div class="kb-stats" v-if="vectors.length > 0">
          <h3>知识库统计</h3>
          <div class="stats-info">
            <p>总文件数：{{ fileStats.totalFiles }}</p>
            <p>总片段数：{{ fileStats.totalChunks }}</p>
            <p>向量维数：{{ fileStats.vectorDimension }}</p>
          </div>
        </div>

        <!-- 添加文件片段列表 -->
        <div class="file-chunks">
          <div v-for="(chunks, fileName) in groupedChunks" :key="fileName" class="file-group">
            <div class="file-header" @click="toggleFileExpand(fileName)">
              <span class="file-name">{{ fileName }}</span>
              <span class="chunk-count">({{ chunks.length }} 个片段)</span>
              <span class="expand-icon">{{ isFileExpanded(fileName) ? '▼' : '▶' }}</span>
            </div>
            <div v-if="isFileExpanded(fileName)" class="chunk-list">
              <div v-for="chunk in chunks" :key="chunk.source" class="chunk-item">
                <div class="chunk-header">
                  <span>{{ chunk.source }}</span>
                  <span class="file-type">{{ chunk.fileType.toUpperCase() }}</span>
                  <span class="chunk-length">({{ chunk.content.length }} 字符)</span>
                </div>
                <p class="chunk-preview">{{ getChunkPreview(chunk) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧聊天部分 -->
      <div class="chat-section">
        <h2>智能问答</h2>
        <div class="model-selector">
          <select v-model="selectedModel">
            <option v-for="model in availableModels" 
                    :key="model.id" 
                    :value="model.id">
              {{ model.name }}
            </option>
          </select>
        </div>
        
        <div class="chat-messages" ref="chatMessages">
          <div v-for="(message, index) in chatHistory" 
               :key="index" 
               :class="['message', message.role]">
            <p v-if="message.role === 'user'">{{ message.content }}</p>
            <p v-else v-html="message.content"></p>
          </div>
          <div v-if="isStreaming" class="message assistant typing">
            <p v-html="currentStreamMessage"></p>
          </div>
        </div>
        
        <div class="chat-input">
          <input type="text" 
                 v-model="chatInput" 
                 @keyup.enter="sendMessage"
                 placeholder="输入消息与AI对话">
          <button @click="sendMessage">发送</button>
        </div>
      </div>
    </div>

    <!-- 添加弹窗组件 -->
    <div class="toast-container" v-if="toast.show">
      <div class="toast" :class="toast.type">
        <div class="toast-content">
          <span class="toast-icon">
            {{ toast.type === 'success' ? '✓' : toast.type === 'error' ? '✕' : 'ℹ' }}
          </span>
          <span class="toast-message" v-html="toast.message.replace(/\n/g, '<br>')"></span>
        </div>
        <button class="toast-close" @click="hideToast">×</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'KnowledgeBase',
  data() {
    return {
      searchQuery: '',
      searchResults: [],
      files: [],
      vectors: [], // 存储向量化后的文档
      ollamaEndpoint: localStorage.getItem('ollamaEndpoint') || 'http://127.0.0.1:11434',
      chatInput: '',
      chatHistory: [],
      isProcessing: false,
      selectedModel: 'llama3.2',
      availableModels: [
        { id: 'llama3.2', name: 'llama3.2' }
      ],
      currentStreamMessage: '',
      isStreaming: false,
      indexModel: 'nomic-embed-text',  // 添加索引模型配置
      chunkSize: 1000,  // 增加块大小以保持更多上下文
      overlapSize: 200,  // 增加重叠区域以保持连贯性
      minChunkSize: 100,  // 最小块大小
      connectionStatus: '',
      keywordWeight: 0.3,    // 关键词匹配权重
      vectorWeight: 0.7,     // 向量相似度权重
      minKeywordScore: 0.1,  // 最小关键词匹配分数
      expandedFiles: new Map(), // 使用 Map 替代普通对象
      supportedFormats: {
        'text/plain': '.txt',
        'text/markdown': '.md',
      },
      uploadStatus: {
        isUploading: false,
        progress: 0,
        currentFile: '',
        currentChunk: 0,
        totalChunks: 0,
        processedFiles: 0,
        totalFiles: 0
      },
      toast: {
        show: false,
        message: '',
        type: 'info', // 'success', 'error', 'info'
        timeout: null
      },
      chunkConfig: {
        txt: {
          maxSize: 1000,
          minSize: 100,
          overlap: 200
        },
        md: {
          maxSize: 1500,
          minSize: 150,
          overlap: 300,
          headingLevels: {
            h1: 1500,
            h2: 1200,
            h3: 1000,
            h4: 800
          }
        }
      }
    }
  },
  computed: {
    // 按文件名分组的片段
    groupedChunks() {
      const groups = {}
      this.vectors.forEach(vec => {
        const fileName = vec.title
        if (!groups[fileName]) {
          groups[fileName] = []
        }
        groups[fileName].push(vec)
      })
      return groups
    },
    // 知识库统计信息
    fileStats() {
      const uniqueFiles = new Set(this.vectors.map(v => v.title))
      return {
        totalFiles: uniqueFiles.size,
        totalChunks: this.vectors.length,
        vectorDimension: this.vectors[0]?.vector?.length || 0
      }
    },
    // 修改模板中的判断逻辑
    isFileExpanded() {
      return (fileName) => this.expandedFiles.get(fileName) || false
    }
  },
  watch: {
    ollamaEndpoint(newValue) {
      localStorage.setItem('ollamaEndpoint', newValue)
    }
  },
  methods: {
    // 使用Ollama进行文本向量化
    async getEmbedding(text, model = this.indexModel) {
      try {
        const response = await fetch(`${this.ollamaEndpoint}/api/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: model,
            prompt: text
          })
        })
        const data = await response.json()
        return data.embedding
      } catch (error) {
        console.error('获取向量失败:', error)
        throw error
      }
    },

    // 计算余弦相似度
    cosineSimilarity(vecA, vecB) {
      const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0)
      const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0))
      const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0))
      return dotProduct / (magnitudeA * magnitudeB)
    },

    handleFileUpload(event) {
      this.files = event.target.files
    },

    // 修改文件上传处理方法
    async uploadFiles() {
      try {
        const totalFiles = this.files.length
        if (totalFiles === 0) {
          this.showToast('请选择要上传的文件', 'error')
          return
        }

        this.uploadStatus = {
          isUploading: true,
          progress: 0,
          currentFile: '',
          currentChunk: 0,
          totalChunks: 0,
          processedFiles: 0,
          totalFiles
        }

        let invalidFiles = []

        for (const file of this.files) {
          if (!this.isValidFileType(file)) {
            invalidFiles.push(file.name)
            this.uploadStatus.processedFiles++
            continue
          }

          this.uploadStatus.currentFile = file.name
          
          const reader = new FileReader()
          reader.onload = async (e) => {
            const content = e.target.result
            let chunks = []
            
            // 根据文件类型处理内容
            const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
            if (extension === '.md') {
              // 直接使用 splitMarkdownContent 处理 Markdown 文件
              chunks = this.splitMarkdownContent(content, file.name, this.chunkConfig.md)
            } else {
              chunks = this.splitIntoChunks(content, file.name)
            }

            this.uploadStatus.totalChunks = chunks.length
            this.uploadStatus.currentChunk = 0
            
            for (const chunk of chunks) {
              this.uploadStatus.currentChunk++
              const vector = await this.getEmbedding(chunk.content, this.indexModel)
              this.vectors.push({
                ...chunk,
                vector: vector
              })

              // 更新进度
              this.uploadStatus.progress = Math.round(
                (this.uploadStatus.processedFiles * 100 / totalFiles) +
                (this.uploadStatus.currentChunk * 100 / chunks.length / totalFiles)
              )
            }

            this.uploadStatus.processedFiles++
            
            if (this.uploadStatus.processedFiles === totalFiles) {
              let message = `处理完成！\n共处理 ${totalFiles - invalidFiles.length} 个文件，生成 ${this.vectors.length} 个文本片段`
              if (invalidFiles.length > 0) {
                message += `\n以下文件格式不支持：\n${invalidFiles.join('\n')}`
              }
              this.showToast(message, 'success', 5000)
              this.uploadStatus.isUploading = false
            }
          }
          reader.readAsText(file)
        }
      } catch (error) {
        console.error('文件处理错误:', error)
        this.showToast('文件处理失败', 'error')
        this.uploadStatus.isUploading = false
      }
    },

    // 修改文件片段显示
    getChunkPreview(chunk) {
      const preview = chunk.content.slice(0, 100)
      return `[${chunk.fileType.toUpperCase()}] ${preview}...`
    },

    // 改进的分词方法
    tokenize(text) {
      // 处理中文
      text = text.replace(/[\u4e00-\u9fa5]/g, str => str + ' ')
      // 处理英文和数字
      text = text.replace(/[a-zA-Z0-9]+/g, str => ' ' + str + ' ')
      // 分词并过滤空字符
      return text.toLowerCase()
        .split(/[\s,.!?;:，。！？；：]+/)
        .filter(term => term.length > 0)
    },

    // 修改混合检索方法
    async getHybridSearchResults(query, documents) {
      // 获取向量相似度分数
      const queryVector = await this.getEmbedding(query, this.indexModel)
      const vectorScores = documents.map(doc => ({
        ...doc,
        vectorScore: this.cosineSimilarity(queryVector, doc.vector)
      }))

      // 获取关键词匹配分数
      const keywordScores = documents.map(doc => ({
        ...doc,
        keywordScore: this.calculateBM25Score(query, doc)
      }))

      // 归一化处理
      const maxVectorScore = Math.max(...vectorScores.map(d => d.vectorScore), 0.0001)
      const maxKeywordScore = Math.max(...keywordScores.map(d => d.keywordScore), 0.0001)
      const minKeywordScore = Math.min(...keywordScores.map(d => d.keywordScore))

      const normalizedResults = documents.map(doc => {
        const vectorScore = vectorScores.find(d => d.source === doc.source).vectorScore
        const keywordScore = keywordScores.find(d => d.source === doc.source).keywordScore

        // 向量分数已经在0-1范围内，只需要归一化
        const normalizedVectorScore = vectorScore / maxVectorScore

        // 关键词分数归一化到0-1范围
        const normalizedKeywordScore = keywordScore / maxKeywordScore

        // 计算混合分数
        const hybridScore = 
          this.vectorWeight * normalizedVectorScore + 
          this.keywordWeight * normalizedKeywordScore

        // 计算显示用的百分比
        const vectorPercentage = (normalizedVectorScore * 100).toFixed(1)
        const keywordPercentage = (normalizedKeywordScore * 100).toFixed(1)

        return {
          ...doc,
          vectorScore: normalizedVectorScore,
          keywordScore: normalizedKeywordScore,
          rawVectorScore: vectorPercentage,    // 存储为字符串，已包含小数点后1位
          rawKeywordScore: keywordPercentage,  // 存储为字符串，已包含小数点后1位
          hybridScore
        }
      })

      return normalizedResults
    },

    // 修改BM25分数计算
    calculateBM25Score(query, document) {
      const k1 = 1.5
      const b = 0.75

      // 分词
      const queryTerms = this.tokenize(query)
      const docTerms = this.tokenize(document.content)
      
      // 计算平均文档长度
      const avgDocLength = this.vectors.reduce((sum, doc) => 
        sum + this.tokenize(doc.content).length, 0
      ) / this.vectors.length

      // 计算文档长度
      const docLength = docTerms.length

      // 计算词频
      const termFreq = {}
      docTerms.forEach(term => {
        termFreq[term] = (termFreq[term] || 0) + 1
      })

      // 计算每个查询词的得分
      let score = 0
      for (const term of queryTerms) {
        // 计算文档频率（包含该词的文档数量）
        const docsWithTerm = this.vectors.filter(doc => 
          this.tokenize(doc.content).includes(term)
        ).length

        if (docsWithTerm === 0) continue

        // 计算IDF
        const idf = Math.log(
          (this.vectors.length - docsWithTerm + 0.5) / 
          (docsWithTerm + 0.5) + 1
        )

        // 计算TF
        const tf = termFreq[term] || 0

        // 计算该词的BM25分数
        const termScore = idf * (tf * (k1 + 1)) / 
          (tf + k1 * (1 - b + b * docLength / avgDocLength))

        score += termScore
      }

      // 调试输出
      if (score > 0) {
        console.log('BM25 Score:', {
          query,
          docTitle: document.title,
          queryTerms,
          score
        })
      }

      // 限制最终分数在合理范围内
      const maxScore = 5  // 降低最大分数限制
      return Math.min(score, maxScore)
    },

    // 修改搜索文档方法的显示部分
    async searchDocuments() {
      try {
        if (!this.searchQuery) return

        const results = await this.getHybridSearchResults(this.searchQuery, this.vectors)
        
        this.searchResults = results
          .sort((a, b) => b.hybridScore - a.hybridScore)
          .slice(0, 5)
          .map(result => ({
            title: result.title,
            content: result.content,
            similarity: `向量相似度: ${result.rawVectorScore}%, 关键词匹配度: ${result.rawKeywordScore}%`
          }))
      } catch (error) {
        console.error('搜索错误:', error)
        alert('搜索失败')
      }
    },

    // 修改相关上下文获取方法的显示部分
    async getRelevantContext(query) {
      try {
        const results = await this.getHybridSearchResults(query, this.vectors)
        
        const sortedResults = results
          .sort((a, b) => b.hybridScore - a.hybridScore)
          .filter(doc => doc.hybridScore > 0.3)
          .slice(0, 3)

        if (sortedResults.length === 0) {
          return '未找到相关的参考文档。'
        }

        return sortedResults.map(r => {
          const similarityLevel = this.getHybridSimilarityLevel(r)
          return `文档《${r.source}》(相关度: ${similarityLevel}, 向量相似度: ${r.rawVectorScore}%, 关键词匹配度: ${r.rawKeywordScore}%):\n${r.content}`
        }).join('\n\n')
      } catch (error) {
        console.error('获取相关上下文失败:', error)
        return '获取参考文档时出现错误。'
      }
    },

    // 修改相似度等级的判断标准
    getHybridSimilarityLevel(result) {
      const score = result.hybridScore
      if (score > 0.8) return '极高'
      if (score > 0.6) return '高'
      if (score > 0.4) return '中等'
      if (score > 0.2) return '较低'
      return '很低'
    },

    async sendMessage() {
      if (!this.chatInput.trim() || this.isProcessing) return
      
      this.isProcessing = true
      this.isStreaming = true
      const userMessage = this.chatInput.trim()
      this.chatHistory.push({ role: 'user', content: userMessage })
      this.chatInput = ''
      this.currentStreamMessage = ''

      try {
        // 获取相关上下文
        const context = await this.getRelevantContext(userMessage)
        
        // 构建提示词
        const prompt = `你是一个智能助手。请基于提供的参考文档来回答用户的问题。

回答要求：
1. 在回答开始时，先列出你参考的文档标题
2. 如果参考文档中没有相关信息，请明确告知无法回答
3. 如果参考文档信息不完整，可以基于已有信息进行合理推测，但必须明确指出哪些是推测的内容
4. 回答要简洁清晰，并尽可能引用原文关键内容
5. 如果相似度较低，请说明参考文档的相关性可能不高

参考文档：
${context}

用户问题：${userMessage}

请按照以上要求给出回答：`

        const response = await fetch(`${this.ollamaEndpoint}/api/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.selectedModel,
            prompt: prompt,
            stream: true,  // 启用流式输出
            options: {
              temperature: 0.7,
              top_k: 40,
              top_p: 0.9
            }
          })
        })

        const reader = response.body.getReader()
        const decoder = new TextDecoder()

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')
          
          for (const line of lines) {
            if (line.trim() === '') continue
            
            try {
              const json = JSON.parse(line)
              if (json.response) {
                this.currentStreamMessage += json.response
                
                // 自动滚动到底部
                this.$nextTick(() => {
                  const chatMessages = this.$refs.chatMessages
                  chatMessages.scrollTop = chatMessages.scrollHeight
                })
              }
            } catch (e) {
              console.error('解析流数据失败:', e)
            }
          }
        }

        // 将完整的回复添加到聊天历史
        this.chatHistory.push({ 
          role: 'assistant', 
          content: this.currentStreamMessage 
        })
        
      } catch (error) {
        console.error('聊天请求失败:', error)
        this.chatHistory.push({ 
          role: 'assistant', 
          content: '抱歉，处理您的消息时出现错误。' 
        })
      } finally {
        this.isProcessing = false
        this.isStreaming = false
        this.currentStreamMessage = ''
      }
    },

    async testConnection() {
      try {
        const response = await fetch(`${this.ollamaEndpoint}/api/tags`)
        if (response.ok) {
          const data = await response.json()
          this.availableModels = data.models
            .filter(model => model.name !== 'nomic-embed-text')
            .map(model => ({
              id: model.name,
              name: model.name
            }))
          this.showToast('连接成功！已更新可用模型列表。', 'success')
        } else {
          throw new Error('服务器响应异常')
        }
      } catch (error) {
        console.error('连接测试失败:', error)
        this.showToast('连接失败，请检查服务地址是否正确。', 'error')
      }
    },

    // 显示弹窗提示
    showToast(message, type = 'info', duration = 3000) {
      // 清除之前的定时器
      if (this.toast.timeout) {
        clearTimeout(this.toast.timeout)
      }

      this.toast.message = message
      this.toast.type = type
      this.toast.show = true

      // 设置自动关闭
      if (duration > 0) {
        this.toast.timeout = setTimeout(() => {
          this.hideToast()
        }, duration)
      }
    },

    // 隐藏弹窗
    hideToast() {
      this.toast.show = false
      if (this.toast.timeout) {
        clearTimeout(this.toast.timeout)
        this.toast.timeout = null
      }
    },

    // 添加 Markdown 章节解析方法
    parseMdSections(content) {
      const lines = content.split('\n')
      const sections = []
      let currentSection = {
        heading: '',
        content: [],
        level: 0
      }
      let inCodeBlock = false

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]

        // 处理代码块
        if (line.startsWith('```')) {
          inCodeBlock = !inCodeBlock
          continue
        }

        // 在代码块内的内容直接添加
        if (inCodeBlock) {
          currentSection.content.push(line)
          continue
        }

        // 检测标题
        const headingMatch = line.match(/^(#{1,6})\s+(.+)/)
        if (headingMatch) {
          // 保存之前的章节
          if (currentSection.content.length > 0 || currentSection.heading) {
            sections.push({
              ...currentSection,
              content: this.cleanMdContent(currentSection.content.join('\n'))
            })
          }

          // 开始新章节
          currentSection = {
            heading: headingMatch[2].trim(),
            content: [],
            level: headingMatch[1].length
          }
        } else {
          // 处理普通内容
          currentSection.content.push(line)
        }
      }

      // 保存最后一个章节
      if (currentSection.content.length > 0 || currentSection.heading) {
        sections.push({
          ...currentSection,
          content: this.cleanMdContent(currentSection.content.join('\n'))
        })
      }

      // 如果没有任何章节（没有标题），创建一个默认章节
      if (sections.length === 0) {
        sections.push({
          heading: '文档内容',
          content: this.cleanMdContent(content),
          level: 1
        })
      }

      return sections
    },

    // 清理 Markdown 内容
    cleanMdContent(text) {
      return text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 移除链接，保留文本
        .replace(/[*_]{1,2}([^*_]+)[*_]{1,2}/g, '$1') // 移除加粗和斜体标记
        .replace(/`([^`]+)`/g, '$1') // 移除行内代码标记
        .replace(/^\s*[-*+]\s+/gm, '') // 移除无序列表标记
        .replace(/^\s*\d+\.\s+/gm, '') // 移除有序列表标记
        .replace(/^\s*>\s+/gm, '') // 移除引用标记
        .replace(/\n{3,}/g, '\n\n') // 合并多个空行
        .trim()
    },

    // 修改文件分割入口方法
    splitIntoChunks(content, filename) {
      const extension = filename.toLowerCase().slice(filename.lastIndexOf('.') + 1)
      const config = this.chunkConfig[extension] || this.chunkConfig.txt

      // 预处理文本
      content = this.preprocessText(content)
      
      // 根据文件类型选择分段策略
      if (extension === 'md') {
        return this.splitMarkdownContent(content, filename, config)
      } else {
        // 直接使用 splitTextContent 处理普通文本
        return this.splitTextContent(content, filename, config)
      }
    },

    // 优化文本分割方法
    splitTextContent(content, filename, config) {
      // 首先按自然段落分割
      const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim())
      const chunks = []
      let currentChunk = {
        title: filename,
        content: '',
        length: 0,
        metadata: {
          sectionIndex: 0
        }
      }

      for (let i = 0; i < paragraphs.length; i++) {
        const paragraph = paragraphs[i].trim()
        if (!paragraph) continue

        // 处理超长段落
        if (paragraph.length > config.maxSize) {
          // 如果当前块不为空，先保存
          if (currentChunk.length >= config.minSize) {
            chunks.push(this.finalizeChunk(currentChunk, filename, chunks.length))
            currentChunk = {
              title: filename,
              content: '',
              length: 0,
              metadata: {
                sectionIndex: 0
              }
            }
          }

          // 分割长段落
          const sentences = paragraph.match(/[^.!?。！？]+[.!?。！？]+/g) || [paragraph]
          let sentenceChunk = ''

          for (const sentence of sentences) {
            if (sentenceChunk.length + sentence.length > config.maxSize) {
              if (sentenceChunk.length >= config.minSize) {
                chunks.push(this.finalizeChunk({
                  title: filename,
                  content: sentenceChunk.trim(),
                  length: sentenceChunk.length,
                  metadata: {
                    sectionIndex: 0
                  }
                }, filename, chunks.length))
                sentenceChunk = ''
              }
            }
            sentenceChunk += sentence + ' '
          }

          // 保存剩余的句子
          if (sentenceChunk.length >= config.minSize) {
            chunks.push(this.finalizeChunk({
              title: filename,
              content: sentenceChunk.trim(),
              length: sentenceChunk.length,
              metadata: {
                sectionIndex: 0
              }
            }, filename, chunks.length))
          }
          continue
        }

        // 检查是否需要开始新的块
        if (currentChunk.length + paragraph.length > config.maxSize) {
          if (currentChunk.length >= config.minSize) {
            chunks.push(this.finalizeChunk(currentChunk, filename, chunks.length))
            // 创建新块，包含重叠内容
            const overlap = this.getLastSentences(currentChunk.content, config.overlap)
            currentChunk = {
              title: filename,
              content: overlap,
              length: overlap.length,
              metadata: {
                sectionIndex: 0
              }
            }
          }
        }

        // 添加段落到当前块
        if (currentChunk.content) {
          currentChunk.content += '\n\n'
          currentChunk.length += 2
        }
        currentChunk.content += paragraph
        currentChunk.length += paragraph.length
      }

      // 保存最后一个块
      if (currentChunk.length >= config.minSize) {
        chunks.push(this.finalizeChunk(currentChunk, filename, chunks.length))
      }

      // 如果没有生成任何块，创建一个包含整个文档的块
      if (chunks.length === 0 && content.trim()) {
        chunks.push(this.finalizeChunk({
          title: filename,
          content: content.trim(),
          length: content.trim().length,
          metadata: {
            sectionIndex: 0
          }
        }, filename, 0))
      }

      return chunks
    },

    // 获取最后几个句子作为重叠内容
    getLastSentences(text, targetLength) {
      const sentences = text.match(/[^.!?。！？]+[.!?。！？]+/g) || []
      let result = ''
      
      for (let i = sentences.length - 1; i >= 0; i--) {
        const sentence = sentences[i]
        if (result.length + sentence.length > targetLength) {
          break
        }
        result = sentence + (result ? ' ' : '') + result
      }
      
      return result.trim()
    },

    // 添加文件类型检查方法
    isValidFileType(file) {
      const validExtensions = ['.txt', '.md']
      const extension = file.name.toLowerCase().slice(file.name.lastIndexOf('.'))
      return validExtensions.includes(extension)
    },

    // 添加文本预处理方法
    preprocessText(text) {
      return text
        .replace(/\r\n/g, '\n') // 统一换行符
        .replace(/\n{3,}/g, '\n\n') // 合并多个空行
        .replace(/\s+/g, ' ') // 合并多个空格
        .trim()
    },

    // 添加块完成处理方法
    finalizeChunk(chunk, filename, index) {
      return {
        ...chunk,
        source: `${filename} (片段 ${index + 1})`,
        fileType: filename.split('.').pop().toLowerCase()
      }
    },

    // 添加 Markdown 文档分割方法
    splitMarkdownContent(content, filename, config) {
      // 解析文档结构
      const sections = this.parseMdSections(content)
      const chunks = []

      // 处理每个章节
      sections.forEach((section, sectionIndex) => {
        // 根据标题级别调整块大小
        const sectionConfig = {
          ...config,
          maxSize: config.headingLevels[`h${section.level}`] || config.maxSize
        }

        // 分割章节内容
        const paragraphs = section.content.split(/\n\s*\n/).filter(p => p.trim())
        let currentChunk = {
          title: filename,
          content: section.heading ? `# ${section.heading}\n\n` : '', // 在每个块的开始添加标题
          length: section.heading ? section.heading.length + 3 : 0,
          metadata: {
            heading: section.heading,
            level: section.level,
            sectionIndex
          }
        }

        // 处理段落
        for (const paragraph of paragraphs) {
          const cleanParagraph = paragraph.trim()
          if (!cleanParagraph) continue

          // 检查是否需要开始新的块
          if (currentChunk.length + cleanParagraph.length > sectionConfig.maxSize) {
            if (currentChunk.length >= sectionConfig.minSize) {
              chunks.push(this.finalizeChunk(currentChunk, filename, chunks.length))
              // 创建新块，保持标题信息
              currentChunk = {
                title: filename,
                content: section.heading ? `# ${section.heading}\n\n` : '',
                length: section.heading ? section.heading.length + 3 : 0,
                metadata: {
                  heading: section.heading,
                  level: section.level,
                  sectionIndex
                }
              }
            }
          }

          // 添加段落到当前块
          if (currentChunk.content) {
            currentChunk.content += '\n\n'
            currentChunk.length += 2
          }
          currentChunk.content += cleanParagraph
          currentChunk.length += cleanParagraph.length
        }

        // 保存最后一个块
        if (currentChunk.length >= sectionConfig.minSize) {
          chunks.push(this.finalizeChunk(currentChunk, filename, chunks.length))
        }
      })

      // 如果没有生成任何块，创建一个包含整个文档的块
      if (chunks.length === 0 && content.trim()) {
        chunks.push(this.finalizeChunk({
          title: filename,
          content: content.trim(),
          length: content.trim().length,
          metadata: {
            heading: '文档内容',
            level: 1,
            sectionIndex: 0
          }
        }, filename, 0))
      }

      return chunks
    },

    // 添加文件展开/折叠切换方法
    toggleFileExpand(fileName) {
      // 使用 Map 的 set 方法设置状态
      this.expandedFiles.set(fileName, !this.expandedFiles.get(fileName))
      // 强制更新视图
      this.expandedFiles = new Map(this.expandedFiles)
    },

    // 添加文件展开状态检查方法
    isFileExpanded(fileName) {
      return this.expandedFiles.get(fileName) || false
    }
  }
}
</script>

<style scoped>
/* 修改基础布局样式 */
.knowledge-base {
  padding: 20px;
  min-height: 100vh;
  height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  max-width: 100%; /* 确保不超过视口宽度 */
  margin: 0; /* 移除可能的外边距 */
}

.settings-section {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  flex-shrink: 0; /* 防止设置区域被压缩 */
}

.main-content {
  display: flex;
  gap: 20px;
  flex: 1;
  min-height: 0;
  height: 0;
  overflow: hidden;
  width: 100%; /* 确保宽度充满 */
}

.knowledge-section {
  flex: 2; /* 增加知识库部分的比例 */
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  min-width: 400px; /* 增加最小宽度 */
}

.chat-section {
  flex: 1; /* 减小聊天部分的比例 */
  display: flex;
  flex-direction: column;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
  min-width: 300px;
}

/* 调整内容区域的宽度 */
.upload-section,
.search-section,
.kb-stats,
.file-chunks {
  width: 100%;
  box-sizing: border-box;
}

/* 调整文件列表的显示 */
.file-group {
  width: 100%;
  box-sizing: border-box;
}

/* 调整搜索结果区域 */
.results-section {
  width: 100%;
  box-sizing: border-box;
}

/* 响应式布局调整 */
@media (max-width: 1024px) {
  .main-content {
    flex-direction: column;
  }

  .knowledge-section,
  .chat-section {
    width: 100%;
    flex: none;
    min-width: 100%;
  }
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap; /* 允许在小屏幕上换行 */
}

.setting-item label {
  min-width: 120px;
  font-weight: 500;
}

.setting-item input {
  flex: 1;
  min-width: 200px; /* 输入框最小宽度 */
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

/* 搜索和上传部分的响应式调整 */
.upload-section, .search-section {
  padding: 15px;
  border-bottom: 1px solid #ddd;
}

.upload-section input[type="file"],
.search-section input[type="text"] {
  width: 100%;
  margin-bottom: 10px;
}

/* 按钮样式优化 */
button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  min-width: 80px;
}

/* 聊天区域的响应式调整 */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #f9f9f9;
}

.message {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 8px;
  max-width: 85%;
  word-wrap: break-word; /* 长文本自动换行 */
}

.message.user {
  background-color: #e3f2fd;
  margin-left: auto;
}

.message.assistant {
  background-color: #f5f5f5;
  margin-right: auto;
}

/* 聊天输入框的响应式调整 */
.chat-input {
  display: flex;
  padding: 15px;
  background-color: white;
  border-top: 1px solid #ddd;
  gap: 10px;
}

.chat-input input {
  flex: 1;
  min-width: 0; /* 允许输入框在flex容器中缩小 */
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

/* 模型选择器的响应式调整 */
.model-selector {
  padding: 10px 15px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.model-selector select {
  width: 100%;
  padding: 8px;
  border-radius: 4px;
  border: 1px solid #ddd;
  font-size: 14px;
}

/* 搜索结果的响应式调整 */
.result-item {
  background-color: white;
  margin-bottom: 10px;
  padding: 15px;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  word-wrap: break-word; /* 长文本自动换行 */
}

/* 标题样式 */
h2 {
  margin: 0;
  padding: 15px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
  font-size: 1.2em;
  text-align: center;
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

/* 保持其他现有样式 */
.message p {
  white-space: pre-wrap;
  margin: 0;
}

.message.assistant p:last-child::after {
  content: none;
}

@keyframes cursor {
  0% { opacity: 0; }
  50% { opacity: 1; }
  100% { opacity: 0; }
}

/* 小屏幕适配 */
@media (max-width: 768px) {
  .knowledge-base {
    padding: 10px;
  }

  .main-content {
    gap: 10px;
  }

  .setting-item {
    flex-direction: column;
    align-items: stretch;
  }

  .setting-item label {
    min-width: auto;
    margin-bottom: 5px;
  }

  .message {
    max-width: 95%;
  }

  button {
    padding: 8px 12px;
    min-width: 60px;
  }
}

.kb-stats {
  padding: 15px;
  background-color: #f8f9fa;
  border-bottom: 1px solid #ddd;
}

.kb-stats h3 {
  margin: 0 0 10px 0;
  font-size: 1em;
  color: #333;
}

.stats-info p {
  margin: 5px 0;
  font-size: 0.9em;
  color: #666;
}

.file-chunks {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.file-group {
  margin-bottom: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.file-header {
  padding: 10px;
  background-color: #f8f9fa;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  font-weight: 500;
  flex: 1;
}

.chunk-count {
  color: #666;
  font-size: 0.9em;
}

.expand-icon {
  color: #666;
  font-size: 0.8em;
}

.chunk-list {
  padding: 10px;
  background-color: white;
}

.chunk-item {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.chunk-item:last-child {
  border-bottom: none;
}

.chunk-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 5px;
}

.chunk-length {
  font-size: 0.8em;
  color: #666;
}

.chunk-preview {
  margin: 0;
  font-size: 0.9em;
  color: #666;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 添加新样式 */
.supported-formats {
  font-size: 0.8em;
  color: #666;
  margin: 5px 0;
}

.file-type {
  background-color: #e9ecef;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8em;
  color: #495057;
  margin-right: 8px;
}

/* 知识库区块样式 */
.upload-block,
.search-block {
  width: 100%;
  border-bottom: 1px solid #ddd;
  background-color: #fff;
}

.upload-block h3,
.search-block h3 {
  margin: 0;
  padding: 12px 15px;
  font-size: 1em;
  background-color: #f8f9fa;
  border-bottom: 1px solid #ddd;
  color: #333;
}

/* 上传区域样式 */
.upload-section {
  padding: 15px;
  background-color: #fff;
}

/* 搜索区域样式 */
.search-section {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.search-input-wrapper {
  display: flex;
  gap: 10px;
  width: 100%;
}

.search-input-wrapper input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.search-input-wrapper button {
  min-width: 80px;
  white-space: nowrap;
}

/* 搜索结果样式 */
.results-section {
  flex: 1;
  overflow-y: auto;
  margin-top: 10px;
}

.result-item {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
}

.result-item h4 {
  margin: 0 0 8px 0;
  color: #2c3e50;
  font-size: 1em;
}

.result-item p {
  margin: 8px 0;
  color: #666;
  font-size: 0.9em;
  line-height: 1.4;
}

.similarity {
  color: #666;
  font-size: 0.85em;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #eee;
}

/* 响应式调整 */
@media (max-width: 768px) {
  .search-input-wrapper {
    flex-direction: column;
  }
  
  .search-input-wrapper button {
    width: 100%;
  }
}

.upload-status {
  margin: 10px 0;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.progress-bar {
  height: 6px;
  background-color: #eee;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 8px;
}

.progress {
  height: 100%;
  background-color: #4CAF50;
  transition: width 0.3s ease;
}

.status-text {
  font-size: 0.9em;
  color: #666;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.status-text .detail {
  color: #999;
  font-size: 0.9em;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.upload-section {
  position: relative;
}

/* 添加动画效果 */
@keyframes progress-animation {
  0% {
    background-position: 0 0;
  }
  100% {
    background-position: 30px 0;
  }
}

.progress {
  background-image: linear-gradient(
    45deg,
    rgba(255, 255, 255, 0.15) 25%,
    transparent 25%,
    transparent 50%,
    rgba(255, 255, 255, 0.15) 50%,
    rgba(255, 255, 255, 0.15) 75%,
    transparent 75%,
    transparent
  );
  background-size: 30px 30px;
  animation: progress-animation 1s linear infinite;
}

/* 添加弹窗样式 */
.toast-container {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 1000;
}

.toast {
  min-width: 300px;
  max-width: 500px;
  padding: 12px;
  border-radius: 6px;
  background-color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  margin-bottom: 10px;
  display: flex;
  align-items: flex-start;
  animation: slideIn 0.3s ease;
}

.toast-content {
  flex: 1;
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.toast-icon {
  font-size: 18px;
  line-height: 20px;
}

.toast-message {
  flex: 1;
  font-size: 14px;
  line-height: 1.4;
}

.toast-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #666;
  cursor: pointer;
  padding: 0 4px;
  margin-left: 10px;
}

.toast.success {
  border-left: 4px solid #4CAF50;
}

.toast.success .toast-icon {
  color: #4CAF50;
}

.toast.error {
  border-left: 4px solid #f44336;
}

.toast.error .toast-icon {
  color: #f44336;
}

.toast.info {
  border-left: 4px solid #2196F3;
}

.toast.info .toast-icon {
  color: #2196F3;
}

@keyframes slideIn {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

/* 修改搜索区块样式 */
.search-block {
  width: 100%;
  border-bottom: 1px solid #ddd;
  background-color: #fff;
  display: flex;
  flex-direction: column;
  flex: 1; /* 让搜索区块占据剩余空间 */
  min-height: 0; /* 允许内容区域收缩 */
}

/* 修改搜索区域样式 */
.search-section {
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1; /* 占据剩余空间 */
  min-height: 0; /* 允许内容区域收缩 */
  overflow: hidden; /* 防止溢出 */
}

/* 搜索结果区域样式 */
.results-section {
  flex: 1;
  overflow-y: auto;
  margin-top: 10px;
  padding: 0 15px;
  min-height: 100px; /* 设置最小高度 */
  max-height: calc(100% - 60px); /* 减去搜索框的高度 */
}

/* 搜索输入框包装器样式 */
.search-input-wrapper {
  display: flex;
  gap: 10px;
  width: 100%;
  flex-shrink: 0; /* 防止搜索框被压缩 */
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
}

/* 结果项样式优化 */
.result-item {
  background-color: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 10px;
}

/* 确保知识库区域的其他部分不会挤压搜索区域 */
.upload-block {
  flex-shrink: 0; /* 防止上传区域被压缩 */
}

.kb-stats {
  flex-shrink: 0; /* 防止统计区域被压缩 */
}

.file-chunks {
  flex-shrink: 0; /* 防止文件列表区域被压缩 */
}

/* 修改打字机光标样式 */
.message.typing p:last-child::after {
  content: '▋';
  animation: cursor 0.8s infinite;
}
</style>

