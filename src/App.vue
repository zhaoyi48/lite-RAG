<template>
  <div class="knowledge-base">
    <div class="upload-section">
      <input type="file" @change="handleFileUpload" multiple accept=".txt,.pdf,.doc,.docx">
      <button @click="uploadFiles">上传文件</button>
    </div>

    <div class="search-section">
      <input type="text" v-model="searchQuery" placeholder="输入搜索关键词">
      <button @click="searchDocuments">搜索</button>
    </div>

    <div class="results-section">
      <div v-for="(result, index) in searchResults" :key="index" class="result-item">
        <h3>{{ result.title }}</h3>
        <p>{{ result.content }}</p>
        <p class="similarity">相似度: {{ result.similarity }}</p>
      </div>
    </div>

    <div class="chat-section">
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
          <p>{{ message.content }}</p>
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
      ollamaEndpoint: 'http://127.0.0.1:11434', // Ollama默认端点
      chatInput: '',
      chatHistory: [],
      isProcessing: false,
      selectedModel: 'llama3.2',
      availableModels: [
        { id: 'llama3.2', name: 'llama3.2' }
      ],
    }
  },
  methods: {
    // 使用Ollama进行文本向量化
    async getEmbedding(text) {
      try {
        const response = await fetch(`${this.ollamaEndpoint}/api/embeddings`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'nomic-embed-text', // 使用llama2模型，可以根据需要更换
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

    async uploadFiles() {
      try {
        for (const file of this.files) {
          const reader = new FileReader()
          reader.onload = async (e) => {
            const content = e.target.result
            // 使用Ollama获取文档的向量表示
            const vector = await this.getEmbedding(content)
            // 存储向量化后的文档
            this.vectors.push({
              title: file.name,
              content: content,
              vector: vector
            })
          }
          reader.readAsText(file)
        }
        alert('文件上传并向量化成功！')
      } catch (error) {
        console.error('文件处理错误:', error)
        alert('文件处理失败')
      }
    },

    async searchDocuments() {
      try {
        if (!this.searchQuery) return
        
        // 获取搜索查询的向量表示
        const queryVector = await this.getEmbedding(this.searchQuery)
        
        // 计算查询向量与所有文档向量的相似度
        const results = this.vectors.map(doc => ({
          title: doc.title,
          content: doc.content,
          similarity: this.cosineSimilarity(queryVector, doc.vector)
        }))
        
        // 按相似度排序并获取前5个结果
        this.searchResults = results
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
          .map(result => ({
            ...result,
            similarity: (result.similarity * 100).toFixed(2) + '%'
          }))
      } catch (error) {
        console.error('搜索错误:', error)
        alert('搜索失败')
      }
    },

    // 获取相关文档上下文
    async getRelevantContext(query) {
      const queryVector = await this.getEmbedding(query)
      const results = this.vectors.map(doc => ({
        content: doc.content,
        similarity: this.cosineSimilarity(queryVector, doc.vector),
        title: doc.title  // 添加标题信息
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .filter(doc => doc.similarity > 0.3)  // 添加相似度阈值
      .slice(0, 3)
      
      // 格式化上下文，包含文档标题和相似度信息
      return results.map(r => 
        `文档《${r.title}》(相似度: ${(r.similarity * 100).toFixed(1)}%):\n${r.content}`
      ).join('\n\n')
    },

    async sendMessage() {
      if (!this.chatInput.trim() || this.isProcessing) return
      
      this.isProcessing = true
      const userMessage = this.chatInput.trim()
      this.chatHistory.push({ role: 'user', content: userMessage })
      this.chatInput = ''

      try {
        const context = await this.getRelevantContext(userMessage)
        
        // 改进的提示词模板
        const prompt = `你是一个智能助手。请基于提供的参考文档来回答用户的问题。

回答要求：
1. 在回答开始时，先列出你参考的文档标题
2. 如果参考文档中没有相关信息，请明确告知无法回答
3. 如果参考文档信息不完整，可以基于已有信息进行合理推测，但必须明确指出哪些是推测的内容
4. 回答要简洁清晰，并尽可能引用原文关键内容

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
            stream: false,
            options: {
              temperature: 0.7,  // 添加温度参数
              top_k: 40,        // 添加top_k参数
              top_p: 0.9        // 添加top_p参数
            }
          })
        })
        
        const data = await response.json()
        this.chatHistory.push({ role: 'assistant', content: data.response })
        
        // 滚动到最新消息
        this.$nextTick(() => {
          const chatMessages = this.$refs.chatMessages
          chatMessages.scrollTop = chatMessages.scrollHeight
        })
      } catch (error) {
        console.error('聊天请求失败:', error)
        this.chatHistory.push({ 
          role: 'assistant', 
          content: '抱歉，处理您的消息时出现错误。' 
        })
      } finally {
        this.isProcessing = false
      }
    },
  }
}
</script>

<style scoped>
.knowledge-base {
  padding: 20px;
}

.upload-section, .search-section {
  margin-bottom: 20px;
}

input[type="text"] {
  padding: 8px;
  width: 300px;
  margin-right: 10px;
}

button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

button:hover {
  background-color: #45a049;
}

.result-item {
  border: 1px solid #ddd;
  padding: 15px;
  margin-bottom: 10px;
  border-radius: 4px;
}

.similarity {
  color: #666;
  font-size: 0.9em;
}

.chat-section {
  margin-top: 30px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.chat-messages {
  height: 400px;
  overflow-y: auto;
  padding: 20px;
  background-color: #f9f9f9;
}

.message {
  margin-bottom: 15px;
  padding: 10px;
  border-radius: 8px;
  max-width: 80%;
}

.message.user {
  background-color: #e3f2fd;
  margin-left: auto;
}

.message.assistant {
  background-color: #f5f5f5;
  margin-right: auto;
}

.chat-input {
  display: flex;
  padding: 15px;
  background-color: white;
  border-top: 1px solid #ddd;
}

.chat-input input {
  flex: 1;
  margin-right: 10px;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.chat-input button {
  padding: 8px 20px;
}

.model-selector {
  padding: 10px 15px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.model-selector select {
  padding: 6px;
  border-radius: 4px;
  border: 1px solid #ddd;
  width: 200px;
  font-size: 14px;
}
</style>

