# YXChat

AI 聊天助手，基于智谱 AI API 构建的 Web 应用。

## 功能特性

- 🤖 智能对话 - 调用智谱 AI API 进行对话
- 💬 多轮对话 - 支持上下文记忆
- 📝 Markdown 支持 - AI 回复支持 Markdown 渲染
- 💻 代码高亮 - 支持代码块语法高亮
- 📋 复制功能 - 一键复制 AI 回复
- 💾 历史记录 - 本地保存对话历史
- 🗂️ 多会话 - 支持多个对话会话

## 技术栈

- React 19 + TypeScript
- Vite
- Tailwind CSS
- 智谱 AI API (glm-4-flash)

## 环境配置

1. 复制环境变量文件：
```bash
cp .env.example .env
```

2. 编辑 `.env` 文件，配置智谱 AI API Key：
```
VITE_ZHIPU_API_KEY=你的API密钥
```

获取 API Key：https://open.bigmodel.cn/

## 开发

```bash
npm install
npm run dev
```

访问 http://localhost:5173

## 构建

```bash
npm run build
```

构建产物在 `dist` 目录。

## 生产部署

### Vercel 部署

1. 在 Vercel 平台创建项目
2. 添加环境变量 `VITE_ZHIPU_API_KEY`
3. 部署即可

### Netlify 部署

1. 在 Netlify 平台创建项目，连接 Git 仓库
2. 在 "Site settings" → "Environment variables" 中添加：
   - Key: `VITE_ZHIPU_API_KEY`
   - Value: 你的 API 密钥
3. 构建设置：
   - Build command: `npm run build`
   - Publish directory: `dist`
4. 部署即可

### 其他平台

构建后部署 `dist` 目录，确保平台支持以下环境变量：
- `VITE_ZHIPU_API_KEY` - 智谱 AI API Key
