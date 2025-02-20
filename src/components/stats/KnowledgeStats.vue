<template>
  <div class="stats-container">
    <div class="stat-item">
      <div class="stat-label">文件数量</div>
      <div class="stat-value">{{ stats.totalFiles }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">文本片段</div>
      <div class="stat-value">{{ stats.totalChunks }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">向量维度</div>
      <div class="stat-value">{{ stats.vectorDimension }}</div>
    </div>
    <div class="stat-item">
      <div class="stat-label">总字符数</div>
      <div class="stat-value">{{ formatNumber(stats.totalCharacters) }}</div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'KnowledgeStats',
  props: {
    stats: {
      type: Object,
      required: true,
      default: () => ({
        totalFiles: 0,
        totalChunks: 0,
        vectorDimension: 0,
        totalCharacters: 0
      })
    }
  },
  methods: {
    formatNumber(num) {
      return num.toLocaleString()
    }
  }
}
</script>

<style scoped>
.kb-stats {
  padding: 15px;
  background-color: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #dee2e6;
  margin-bottom: 20px;
}

.kb-stats h3 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: #333;
}

.stats-info {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px;
  background-color: white;
  border-radius: 4px;
  border: 1px solid #eee;
}

.stat-label {
  color: #666;
  font-size: 0.9em;
}

.stat-value {
  font-weight: 500;
  color: #2c3e50;
}

@media (max-width: 768px) {
  .kb-stats {
    padding: 12px;
  }
  
  .stat-item {
    padding: 6px;
    font-size: 0.9em;
  }
}
</style> 