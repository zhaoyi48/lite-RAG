// 所有导出的函数声明
export {
  getHybridSearchResults,
  getRelevantContext,
  getEmbedding,
  cosineSimilarity,
  calculateKeywordMatch,
  calculateScore
}

// 混合搜索实现
async function getHybridSearchResults(query, documents, endpoint) {
  // 获取查询向量
  const queryVector = await getEmbedding(query, endpoint)
  
  // 计算向量相似度和关键词匹配分数
  const results = documents.map(doc => ({
    ...doc,
    vectorScore: cosineSimilarity(queryVector, doc.vector),
    keywordScore: calculateBM25Score(query, doc)
  }))
  
  // 归一化分数
  return normalizeAndRankResults(results)
}

// 计算综合相似度得分
function calculateScore(vectorScore, keywordScore) {
  // 向量相似度权重 0.7，关键词匹配权重 0.3
  return (vectorScore * 0.7) + (keywordScore * 0.3)
}

// 计算余弦相似度
function cosineSimilarity(vec1, vec2) {
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0)
  const norm1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0))
  const norm2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0))
  return dotProduct / (norm1 * norm2)
}

// 计算关键词匹配度
function calculateKeywordMatch(query, content) {
  const queryWords = query.toLowerCase().split(/\s+/)
  const contentLower = content.toLowerCase()
  
  // 计算匹配的关键词数量
  const matchedWords = queryWords.filter(word => contentLower.includes(word))
  
  // 计算匹配率 (0-1)
  return matchedWords.length / queryWords.length
}

// 获取相关上下文
async function getRelevantContext(query, vectors, endpoint) {
  if (!vectors.length) return ''

  // 获取查询的向量表示
  const queryVector = await getEmbedding(query, endpoint)
  
  // 计算所有文档片段的相似度得分
  const results = vectors.map(doc => {
    // 计算向量相似度 (0-100)
    const vectorSimilarity = cosineSimilarity(queryVector, doc.vector) * 100
    
    // 计算关键词匹配度 (0-100)
    const keywordSimilarity = calculateKeywordMatch(query, doc.content) * 100
    
    // 计算综合得分
    const score = calculateScore(vectorSimilarity, keywordSimilarity)
    
    return {
      content: doc.content,
      title: doc.title,
      score,
      vectorScore: vectorSimilarity.toFixed(1),
      keywordScore: keywordSimilarity.toFixed(1)
    }
  })

  // 按综合得分排序并获取前5个结果
  const topResults = results
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  // 格式化上下文
  return topResults
    .map(result => (
      `来源: ${result.title}\n` +
      `相关度: ${result.score.toFixed(1)}%\n` +
      `(向量相似度: ${result.vectorScore}%, 关键词匹配度: ${result.keywordScore}%)\n` +
      `内容: ${result.content}\n`
    ))
    .join('\n---\n\n')
}

// 获取向量嵌入
async function getEmbedding(text, endpoint) {
  const response = await fetch(`${endpoint}/api/embeddings`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Request-Private-Network': 'true'
    },
    body: JSON.stringify({
      model: 'nomic-embed-text',
      prompt: text
    })
  })

  if (!response.ok) {
    throw new Error('获取向量失败')
  }

  const data = await response.json()
  return data.embedding
}

// BM25分数计算
function calculateBM25Score(query, document) {
  const k1 = 1.5
  const b = 0.75
  
  // 分词
  const queryTerms = tokenize(query)
  const docTerms = tokenize(document.content)
  
  // 计算词频
  const termFreq = {}
  docTerms.forEach(term => {
    termFreq[term] = (termFreq[term] || 0) + 1
  })
  
  // 计算分数
  let score = 0
  for (const term of queryTerms) {
    const tf = termFreq[term] || 0
    if (tf > 0) {
      score += tf / (tf + k1 * (1 - b + b * docTerms.length / avgDocLength))
    }
  }
  
  return score
}

// 分词函数
function tokenize(text) {
  // 处理中文
  text = text.replace(/[\u4e00-\u9fa5]/g, str => str + ' ')
  // 处理英文和数字
  text = text.replace(/[a-zA-Z0-9]+/g, str => ' ' + str + ' ')
  // 分词并过滤空字符
  return text.toLowerCase()
    .split(/[\s,.!?;:，。！？；：]+/)
    .filter(term => term.length > 0)
}

// 归一化和排序结果
function normalizeAndRankResults(results) {
  const maxVectorScore = Math.max(...results.map(r => r.vectorScore), 0.0001)
  const maxKeywordScore = Math.max(...results.map(r => r.keywordScore), 0.0001)

  return results.map(result => {
    const normalizedVectorScore = result.vectorScore / maxVectorScore
    const normalizedKeywordScore = result.keywordScore / maxKeywordScore
    
    const hybridScore = 0.7 * normalizedVectorScore + 0.3 * normalizedKeywordScore
    
    return {
      ...result,
      rawVectorScore: (normalizedVectorScore * 100).toFixed(1),
      rawKeywordScore: (normalizedKeywordScore * 100).toFixed(1),
      hybridScore
    }
  })
}

// 计算平均文档长度（可以缓存）
const avgDocLength = 500 // 这里使用一个固定值，实际应用中可以动态计算 