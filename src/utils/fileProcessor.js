import * as pdfjsLib from 'pdfjs-dist'
import mammoth from 'mammoth/mammoth.browser'
import * as XLSX from 'xlsx'

// PDF Worker 配置
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href

// 文件处理配置
const CONFIG = {
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
  },
  pdf: {
    maxSize: 1000,
    minSize: 100,
    overlap: 200
  },
  doc: {
    maxSize: 1000,
    minSize: 100,
    overlap: 200
  },
  xls: {
    maxSize: 800,
    minSize: 50,
    overlap: 100
  }
}

// 文件处理主函数
export async function processFile(file, endpoint, status) {
  const fileName = file.name
  const fileType = getFileType(fileName)
  
  if (!CONFIG[fileType]) {
    throw new Error('不支持的文件类型')
  }

  let content = await extractContent(file, fileType)
  const chunks = splitContent(content, fileName, fileType)
  
  // 获取向量
  status.totalChunks = chunks.length
  status.currentChunk = 0
  
  const results = []
  for (const chunk of chunks) {
    status.currentChunk++
    const vector = await getEmbedding(chunk.content, endpoint)
    results.push({
      ...chunk,
      vector
    })
    
    // 更新进度
    status.progress = Math.round(
      (status.processedFiles * 100 / status.totalFiles) +
      (status.currentChunk * 100 / chunks.length / status.totalFiles)
    )
  }
  
  return results
}

// 获取文件类型
function getFileType(fileName) {
  const ext = fileName.split('.').pop().toLowerCase()
  
  switch (ext) {
    case 'txt':
      return 'txt'
    case 'md':
    case 'markdown':
      return 'md'
    case 'pdf':
      return 'pdf'
    case 'doc':
    case 'docx':
      return 'doc'
    case 'xls':
    case 'xlsx':
      return 'xls'
    default:
      throw new Error('不支持的文件类型')
  }
}

// 提取文件内容
async function extractContent(file, fileType) {
  switch (fileType) {
    case 'txt':
    case 'md':
      return await file.text()
      
    case 'pdf':
      return await extractPdfContent(file)
      
    case 'doc':
    case 'docx':
      return await extractWordContent(file)
      
    case 'xls':
    case 'xlsx':
      return await extractExcelContent(file)
      
    default:
      throw new Error('不支持的文件类型')
  }
}

// 提取 PDF 内容
async function extractPdfContent(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  let content = ''
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    content += textContent.items.map(item => item.str).join(' ') + '\n\n'
  }
  
  return content
}

// 提取 Word 文档内容
async function extractWordContent(file) {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const result = await mammoth.convertToHtml({ arrayBuffer })
    
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = result.value
    return tempDiv.textContent || tempDiv.innerText || ''
  } catch (error) {
    console.error('处理 Word 文档失败:', error)
    throw new Error(`处理 Word 文档失败: ${error.message}`)
  }
}

// 提取 Excel 内容
async function extractExcelContent(file) {
  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: 'array' })
  
  // 处理所有工作表
  const sheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name]
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 })
    
    // 过滤空行并格式化
    return {
      name,
      content: data
        .filter(row => row.some(cell => cell)) // 过滤完全空的行
        .map(row => row.join('\t')) // 用制表符分隔单元格
        .join('\n')
    }
  })
  
  // 合并所有工作表内容
  return sheets
    .map(sheet => `工作表: ${sheet.name}\n${sheet.content}`)
    .join('\n\n')
}

// 分割内容
function splitContent(content, fileName, fileType) {
  if (fileType === 'md') {
    return splitMarkdown(content, fileName)
  }
  return splitPlainText(content, fileName, fileType)
}

// 分割普通文本
function splitPlainText(content, fileName, fileType) {
  const config = CONFIG[fileType] || CONFIG.txt
  const chunks = []
  let currentChunk = ''
  let currentSize = 0
  let id = 0
  
  // 按句子分割文本
  const sentences = content.split(/(?<=[。！？.!?])\s+/)
  
  for (const sentence of sentences) {
    const sentenceLength = sentence.length
    
    // 如果当前块加上新句子超过最大大小，保存当前块
    if (currentSize + sentenceLength > config.maxSize && currentSize >= config.minSize) {
      chunks.push(createChunk(fileName, id++, currentChunk, fileType))
      
      // 保留重叠部分
      const words = currentChunk.split(/\s+/)
      currentChunk = words.slice(-Math.floor(config.overlap / 10)).join(' ')
      currentSize = currentChunk.length
    }
    
    currentChunk += (currentChunk ? ' ' : '') + sentence
    currentSize += sentenceLength
  }
  
  // 保存最后一个块
  if (currentChunk) {
    chunks.push(createChunk(fileName, id, currentChunk, fileType))
  }
  
  return chunks
}

// 分割 Markdown
function splitMarkdown(content, fileName) {
  const config = CONFIG.md
  const chunks = []
  let id = 0
  
  // 分割成段落和标题
  const sections = content.split(/(?=#{1,6}\s)/)
  
  let currentSection = {
    title: '',
    content: '',
    level: 0,
    size: 0
  }
  
  for (const section of sections) {
    // 检查是否是标题
    const headingMatch = section.match(/^(#{1,6})\s+(.+)$/m)
    
    if (headingMatch) {
      // 如果有累积的内容，先保存
      if (currentSection.content && currentSection.size >= config.minSize) {
        chunks.push(createChunk(
          fileName,
          id++,
          currentSection.content,
          'md',
          currentSection.title
        ))
      }
      
      // 开始新的段落
      const level = headingMatch[1].length
      const title = headingMatch[2]
      const maxSize = config.headingLevels[`h${level}`] || config.maxSize
      
      currentSection = {
        title: title,
        content: section,
        level: level,
        size: section.length,
        maxSize: maxSize
      }
    } else {
      // 添加到当前段落
      if (currentSection.size + section.length > currentSection.maxSize && 
          currentSection.size >= config.minSize) {
        // 保存当前段落
        chunks.push(createChunk(
          fileName,
          id++,
          currentSection.content,
          'md',
          currentSection.title
        ))
        
        // 开始新段落，保持当前标题
        currentSection.content = section
        currentSection.size = section.length
      } else {
        currentSection.content += section
        currentSection.size += section.length
      }
    }
  }
  
  // 保存最后一个段落
  if (currentSection.content && currentSection.size >= config.minSize) {
    chunks.push(createChunk(
      fileName,
      id,
      currentSection.content,
      'md',
      currentSection.title
    ))
  }
  
  return chunks
}

// 创建文本块
function createChunk(fileName, id, content, fileType, title = '') {
  return {
    id: `${fileName}-${id}`,
    title: fileName,
    content: content.trim(),
    source: title || fileName,
    fileType: fileType
  }
}

// 获取向量嵌入
async function getEmbedding(text, endpoint) {
  const response = await fetch(`${endpoint}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

// ... 其他工具函数 ... 