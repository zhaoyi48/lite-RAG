<template>
  <div class="search-block">
    <h3>知识库搜索</h3>
    <div class="search-section">
      <div class="search-input-wrapper">
        <input 
          type="text" 
          v-model="query" 
          placeholder="输入搜索关键词"
          @keyup.enter="search"
          :disabled="isSearching"
        >
        <button @click="search" :disabled="isSearching">
          {{ isSearching ? '搜索中...' : '搜索' }}
        </button>
      </div>
    </div>

    <!-- 搜索结果弹出层 -->
    <div v-if="showResults" class="results-popup">
      <div class="results-overlay" @click="closeResults"></div>
      <div class="results-container">
        <div class="results-header">
          <h4>搜索结果</h4>
          <button class="close-btn" @click="closeResults">×</button>
        </div>
        
        <div class="results-content">
          <div v-if="results.length === 0" class="empty-results">
            暂无搜索结果
          </div>
          <div v-else v-for="(result, index) in results" 
               :key="index" 
               class="result-item">
            <div class="result-header">
              <h4>{{ result.title }}</h4>
              <div class="score-info">
                <span class="total-score">相关度: {{ result.score.toFixed(1) }}%</span>
                <span class="detail-scores">
                  向量相似度: {{ result.vectorScore }}%
                  关键词匹配度: {{ result.keywordScore }}%
                </span>
              </div>
            </div>
            <p class="content">{{ result.content }}</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { getEmbedding } from '@/utils/search'
import { cosineSimilarity, calculateKeywordMatch, calculateScore } from '@/utils/search'

export default {
  name: 'KnowledgeSearch',
  props: {
    vectors: {
      type: Array,
      required: true
    },
    endpoint: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      query: '',
      results: [],
      isSearching: false,
      showResults: false
    }
  },
  methods: {
    async search() {
      if (!this.query.trim() || this.isSearching) return
      
      this.isSearching = true
      try {
        const queryVector = await getEmbedding(this.query, this.endpoint)
        
        this.results = this.vectors
          .map(doc => {
            const vectorSimilarity = cosineSimilarity(queryVector, doc.vector) * 100
            const keywordSimilarity = calculateKeywordMatch(this.query, doc.content) * 100
            const score = calculateScore(vectorSimilarity, keywordSimilarity)
            
            return {
              ...doc,
              score,
              vectorScore: vectorSimilarity.toFixed(1),
              keywordScore: keywordSimilarity.toFixed(1)
            }
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 5)

        this.showResults = true
      } catch (error) {
        this.$emit('toast', '搜索失败', 'error')
      } finally {
        this.isSearching = false
      }
    },
    closeResults() {
      this.showResults = false
    }
  }
}
</script>

<style scoped>
.search-block {
  padding: 15px;
  border-bottom: 1px solid #eee;
  background: white;
}

.search-block h3 {
  margin: 0 0 15px 0;
  font-size: 1.1em;
  color: #333;
}

.search-section {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
}

.search-input-wrapper {
  display: flex;
  gap: 10px;
}

.search-input-wrapper input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.search-input-wrapper button {
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  min-width: 80px;
}

/* 弹出层样式 */
.results-popup {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  justify-content: center;
  align-items: center;
}

.results-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
}

.results-container {
  position: relative;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
}

.results-header {
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.results-header h4 {
  margin: 0;
  font-size: 1.1em;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0 8px;
}

.results-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.result-item {
  background: #f8f9fa;
  border: 1px solid #eee;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.result-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.1em;
}

.score-info {
  text-align: right;
}

.total-score {
  display: block;
  color: #4CAF50;
  font-weight: 500;
  margin-bottom: 4px;
}

.detail-scores {
  color: #666;
  font-size: 0.9em;
}

.content {
  margin: 0;
  line-height: 1.5;
  color: #333;
}

.empty-results {
  text-align: center;
  color: #666;
  padding: 30px;
  font-style: italic;
}
</style> 