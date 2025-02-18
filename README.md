# Lite-RAG

一个基于 Vue 3 和 Ollama 的轻量级本地知识库问答系统。通过向量检索和大语言模型，实现对本地文档的智能问答。

## 功能特点

- 📚 支持多文件上传和管理
- 🔍 基于向量相似度的文档检索
- 💬 智能问答，支持上下文关联
- 🤖 可选择不同的 Ollama 模型
- 📊 显示相似度匹配结果
- 🌐 纯本地部署，数据安全

## 系统要求

- Node.js 16+
- Ollama 服务
- 支持的浏览器：Chrome、Firefox、Safari 等现代浏览器

## 安装步骤

1. 安装 Ollama
```bash
# MacOS/Linux
curl https://ollama.ai/install.sh | sh

# 或从官网下载安装包：https://ollama.ai/download
```

2. 下载必要的模型
```bash
# 下载向量化模型
ollama pull nomic-embed-text

# 下载对话模型
ollama pull llama3.2
```

3. 安装项目依赖
```bash
npm install
```

4. 配置 Ollama 端点
在 `src/App.vue` 中修改 `ollamaEndpoint` 为你的 Ollama 服务地址：
```javascript
ollamaEndpoint: 'http://localhost:11434'
```

## 开发环境

```bash
# 启动开发服务器
npm run dev
```

## 生产部署

```bash
# 构建生产版本
npm run build
```

## 使用说明

1. 文档上传
   - 支持 .txt、.pdf、.doc、.docx 格式
   - 文件会在本地进行向量化处理
   - 上传完成后可立即使用

2. 文档检索
   - 在搜索框输入关键词
   - 系统会返回相似度最高的文档片段
   - 显示相似度百分比

3. 智能问答
   - 选择合适的对话模型
   - 输入问题后系统会自动检索相关文档
   - AI 会基于检索到的内容进行回答
   - 回答会标注参考的文档来源

## 技术栈

- Vue 3 - 前端框架
- Vite - 构建工具
- Ollama - 本地大语言模型服务
- 向量检索 - 基于余弦相似度算法

## 开发工具推荐

- [VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar)

## 注意事项

- 确保 Ollama 服务正常运行
- 大文件处理可能需要较长时间
- 建议控制单个文档大小在 1MB 以内
- 向量化过程在本地完成，不会上传文档到外部服务器