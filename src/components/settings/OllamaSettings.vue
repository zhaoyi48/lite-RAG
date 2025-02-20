<template>
  <div class="settings-section">
    <div class="setting-item">
      <label>Ollama 服务地址（需要跨域支持OLLAMA_ORIGINS=*）：</label>
      <input 
        type="text" 
        v-model="localEndpoint"
        placeholder="例如：http://127.0.0.1:11434"
      >
      <button @click="testConnection">测试连接</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'OllamaSettings',
  props: {
    endpoint: String
  },
  data() {
    return {
      localEndpoint: this.endpoint
    }
  },
  watch: {
    localEndpoint(val) {
      this.$emit('update:endpoint', val)
    }
  },
  methods: {
    async testConnection() {
      try {
        const response = await fetch(`${this.localEndpoint}/api/tags`)
        if (response.ok) {
          const data = await response.json()
          this.$emit('models-updated', data.models)
          this.$emit('toast', '连接成功！已更新可用模型列表。', 'success')
        } else {
          throw new Error('服务器响应异常')
        }
      } catch (error) {
        this.$emit('toast', '连接失败，请检查服务地址是否正确。', 'error')
      }
    }
  }
}
</script>

<style scoped>
.settings-section {
  margin-bottom: 20px;
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.setting-item label {
  min-width: 120px;
  font-weight: 500;
}

.setting-item input {
  flex: 1;
  min-width: 200px;
  padding: 8px;
  border: 1px solid #ced4da;
  border-radius: 4px;
  font-size: 14px;
}

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
</style> 