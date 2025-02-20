<template>
  <div class="chat-section">
    <h3>智能问答</h3>
    
    <div class="model-selector">
      <select v-model="selectedModel">
        <option value="">请选择模型</option>
        <option v-for="model in models" 
                :key="model.id" 
                :value="model.id">
          {{ model.name }}
        </option>
      </select>
    </div>
    
    <div class="messages-container">
      <div class="chat-messages" ref="messagesContainer">
        <!-- 历史消息 -->
        <div v-for="(message, index) in history" 
             :key="index" 
             :class="['message', message.role]">
          <div v-html="formatMessage(message.content)"></div>
        </div>
        
        <!-- 正在生成的消息 -->
        <div v-if="isTyping" 
             class="message assistant">
          <div v-html="formatMessage(currentResponse)"></div>
          <span class="typing-indicator">▋</span>
        </div>
      </div>
    </div>
    
    <div class="chat-input">
      <input type="text" 
             v-model="currentMessage" 
             @keyup.enter="sendMessage"
             placeholder="输入消息..."
             :disabled="!selectedModel || isProcessing">
      <button @click="sendMessage" 
              :disabled="!selectedModel || isProcessing || !currentMessage.trim()">
        {{ isProcessing ? '生成中...' : '发送' }}
      </button>
    </div>
  </div>
</template>

<script>
import { getRelevantContext } from '@/utils/search'
import { streamChat } from '@/utils/chat'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

export default {
  name: 'ChatWindow',
  props: {
    vectors: {
      type: Array,
      required: true
    },
    endpoint: {
      type: String,
      required: true
    },
    models: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      selectedModel: '',
      currentMessage: '',
      currentResponse: '',
      history: [],
      isProcessing: false,
      isTyping: false
    }
  },
  methods: {
    async sendMessage() {
      if (!this.currentMessage.trim() || !this.selectedModel || this.isProcessing) {
        return
      }

      const userMessage = this.currentMessage.trim()
      this.currentMessage = ''
      
      this.history.push({
        role: 'user',
        content: userMessage
      })
      
      this.isProcessing = true
      this.isTyping = true
      this.currentResponse = ''
      this.scrollToBottom()

      try {
        const context = await getRelevantContext(userMessage, this.vectors, this.endpoint)
        
        const systemPrompt = `你是一个智能助手。请基于以下参考信息回答用户问题。如果参考信息不足以回答问题，请如实说明。

参考信息：
${context}

请记住：
1. 如果参考信息对回答问题有帮助，应该明确引用来源
2. 如果无法从参考信息中找到答案，要诚实地说明
3. 回答要简洁清晰，适当使用 Markdown 格式`

        const messages = [
          { role: 'system', content: systemPrompt },
          ...this.history.map(msg => ({
            role: msg.role,
            content: msg.content
          }))
        ]

        await streamChat({
          endpoint: this.endpoint,
          model: this.selectedModel,
          messages: messages,
          onChunk: (chunk) => {
            this.currentResponse += chunk
            this.scrollToBottom()
          }
        })

        this.history.push({
          role: 'assistant',
          content: this.currentResponse
        })

      } catch (error) {
        this.$emit('toast', `消息处理失败: ${error.message}`, 'error')
        this.history.push({
          role: 'assistant',
          content: `抱歉，处理您的消息时出现错误: ${error.message}`
        })
      } finally {
        this.isProcessing = false
        this.isTyping = false
        this.currentResponse = ''
        this.scrollToBottom()
      }
    },

    formatMessage(content) {
      if (!content) return ''
      const html = marked(content)
      return DOMPurify.sanitize(html)
    },

    scrollToBottom() {
      const container = this.$refs.messagesContainer
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    }
  }
}
</script>

<style scoped>
.chat-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.chat-section h3 {
  margin: 0;
  padding: 15px;
  font-size: 1.1em;
  color: #333;
  border-bottom: 1px solid #eee;
}

.model-selector {
  padding: 15px;
  border-bottom: 1px solid #eee;
  background: white;
}

.model-selector select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.messages-container {
  flex: 1;
  min-height: 0;
  position: relative;
  background: #f8f9fa;
}

.chat-messages {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow-y: auto;
  padding: 15px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.message {
  max-width: 85%;
  padding: 12px 16px;
  border-radius: 8px;
  word-wrap: break-word;
  animation: fadeIn 0.3s ease;
}

.message.user {
  align-self: flex-end;
  background-color: #4CAF50;
  color: white;
}

.message.user :deep(p) {
  margin: 0;
}

.message.assistant {
  align-self: flex-start;
  background-color: white;
  border: 1px solid #eee;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.chat-input {
  padding: 15px;
  display: flex;
  gap: 10px;
  background: white;
  border-top: 1px solid #eee;
}

.chat-input input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.chat-input input:focus {
  outline: none;
  border-color: #4CAF50;
}

.chat-input button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  min-width: 80px;
  transition: background-color 0.2s;
}

.chat-input button:hover:not(:disabled) {
  background-color: #45a049;
}

.chat-input button:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}

.typing-indicator {
  display: inline-block;
  margin-left: 4px;
  animation: blink 1s infinite;
}

@keyframes blink {
  50% { opacity: 0; }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Markdown 样式优化 */
:deep(.message) {
  line-height: 1.6;
}

:deep(.message p) {
  margin: 8px 0;
}

:deep(.message p:first-child) {
  margin-top: 0;
}

:deep(.message p:last-child) {
  margin-bottom: 0;
}

:deep(.message code) {
  background-color: rgba(0, 0, 0, 0.05);
  padding: 0.2em 0.4em;
  border-radius: 3px;
  font-family: monospace;
  font-size: 0.9em;
}

:deep(.message pre) {
  background-color: #f5f5f5;
  padding: 12px 16px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 12px 0;
}

:deep(.message pre:first-child) {
  margin-top: 0;
}

:deep(.message pre:last-child) {
  margin-bottom: 0;
}

:deep(.message pre code) {
  background-color: transparent;
  padding: 0;
  display: block;
  line-height: 1.5;
}

:deep(.message ul, .message ol) {
  margin: 12px 0;
  padding-left: 24px;
}

:deep(.message ul:first-child, .message ol:first-child) {
  margin-top: 0;
}

:deep(.message ul:last-child, .message ol:last-child) {
  margin-bottom: 0;
}

:deep(.message li) {
  margin: 4px 0;
}

:deep(.message blockquote) {
  margin: 12px 0;
  padding: 8px 16px;
  border-left: 3px solid #ddd;
  background-color: rgba(0, 0, 0, 0.02);
  color: #666;
}

:deep(.message blockquote:first-child) {
  margin-top: 0;
}

:deep(.message blockquote:last-child) {
  margin-bottom: 0;
}

:deep(.message blockquote p) {
  margin: 4px 0;
}

/* 滚动条样式 */
.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: #ccc;
}
</style> 