// 流式聊天实现
export async function streamChat({ endpoint, model, messages, onChunk }) {
  const response = await fetch(`${endpoint}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: messages,
      stream: true,
      options: {
        temperature: 0.7
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`聊天请求失败: ${response.status} ${error}`)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.trim()) continue

        try {
          const cleanLine = line.replace(/^data: /, '')
          if (cleanLine === '[DONE]') continue

          const data = JSON.parse(cleanLine)
          
          if (data.message?.content) {
            onChunk(data.message.content)
          } else if (data.content) {
            onChunk(data.content)
          }
        } catch (e) {
          console.error('解析响应失败:', e)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

// ... 其他聊天相关函数 ... 