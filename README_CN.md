[English](README.md)

# Nanobot Dashboard

一个独立的 Web 管理面板，用于管理 [nanobot](https://github.com/HKUDS/nanobot) — 超轻量级个人 AI 助手。

直接读写 nanobot 的文件系统数据（JSON、JSONL、Markdown），无需修改 nanobot 源码。零侵入，独立部署。

## 功能特性

- **状态总览** — 网关进程检测、当前模型显示、通道状态、定时任务/技能/知识库摘要卡片
- **会话浏览** — 按渠道分组的会话列表，消息历史（Markdown 渲染）、备注、搜索
- **定时任务管理** — 完整的增删改查，支持手动触发，文件级锁保护
- **记忆与知识库** — 文件树导航、内联 Markdown 编辑器，支持预览和语法高亮
- **技能查看** — 浏览和编辑技能定义（YAML frontmatter + Markdown）
- **日志查看** — 多文件标签切换，自动滚动到底部，大文件高效尾部读取
- **配置编辑** — 脱敏配置显示 + 原始编辑弹窗；只读视图中敏感信息自动隐藏

## 架构

```
dashboard/
├── server.py              # aiohttp 入口
├── config.py              # 基于环境变量的配置
├── routes/
│   ├── status.py          # GET /api/status
│   ├── sessions.py        # /api/sessions 增删改查 + 备注
│   ├── cron.py            # /api/cron/jobs 增删改查 + 手动触发
│   ├── memory.py          # /api/memory/files 浏览/编辑
│   ├── skills.py          # /api/skills 浏览/编辑
│   ├── config_view.py     # /api/config（脱敏 + 原始 + 写入）
│   └── logs.py            # /api/logs 多文件查看
├── utils/
│   ├── auth.py            # 可选的 Bearer token 中间件
│   ├── nanobot.py         # 网关进程检测、配置/定时任务读取
│   └── sanitize.py        # 路径遍历防护、敏感信息脱敏
├── frontend/              # Lit + Vite + TypeScript
│   └── src/
│       ├── app.ts         # 基于 hash 的 SPA 路由
│       ├── api/client.ts  # 统一的 fetch 封装
│       ├── components/
│       │   ├── nav-sidebar.ts   # SVG 图标导航栏
│       │   └── file-viewer.ts   # Memory/Knowledge 页面的抽象基类
│       ├── pages/         # 每个路由对应一个组件
│       └── utils/
│           └── markdown.ts      # marked + highlight.js
└── static/                # Vite 构建产物（已 gitignore）
```

**后端**：Python aiohttp — 模块化路由处理，可选 Bearer token 认证，`fcntl.flock` 保护定时任务写入安全。

**前端**：Lit 3 Web Components — hash 路由，CSS 自定义属性设计系统（深色主题），`marked` + `highlight.js` 渲染 Markdown。

## 快速开始

### 前置条件

- Python 3.10+
- Node.js 18+
- 已安装的 [nanobot](https://github.com/HKUDS/nanobot) 运行环境（`~/.nanobot/`）

### 安装与运行

```bash
cd ~/.nanobot/dashboard

# 安装前端依赖并构建
cd frontend && npm install && npm run build && cd ..

# 启动服务
make serve
# → http://127.0.0.1:18791
```

### 开发模式

```bash
# 前端开发服务器（热重载，代理到后端）
make dev

# 仅启动后端
make serve

# 完整重构建
make build && make serve
```

## 配置

所有配置通过环境变量设置：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `NANOBOT_ROOT` | `~/.nanobot` | nanobot 安装目录 |
| `NANOBOT_DASHBOARD_HOST` | `127.0.0.1` | 服务绑定地址 |
| `NANOBOT_DASHBOARD_PORT` | `18791` | 服务端口 |
| `NANOBOT_DASHBOARD_TOKEN` | *（空）* | API 认证 Bearer token（可选） |

## API 接口

| 方法 | 端点 | 说明 |
|------|------|------|
| `GET` | `/api/status` | 系统状态（网关、模型、通道、定时任务） |
| `GET` | `/api/sessions` | 会话列表（`?channel=` 筛选） |
| `GET` | `/api/sessions/{key}` | 会话消息 + 元数据 |
| `PATCH` | `/api/sessions/{key}` | 更新会话备注 |
| `DELETE` | `/api/sessions/{key}` | 删除会话 |
| `GET` | `/api/cron/jobs` | 定时任务列表 |
| `POST` | `/api/cron/jobs` | 创建定时任务 |
| `PATCH` | `/api/cron/jobs/{id}` | 更新定时任务 |
| `DELETE` | `/api/cron/jobs/{id}` | 删除定时任务 |
| `POST` | `/api/cron/jobs/{id}/run` | 手动触发定时任务 |
| `GET` | `/api/memory/files` | 工作区文件列表（分组） |
| `GET` | `/api/memory/files/{path}` | 读取文件内容 |
| `PUT` | `/api/memory/files/{path}` | 更新文件内容 |
| `GET` | `/api/skills` | 技能列表（含 frontmatter） |
| `GET` | `/api/skills/{id}/{file}` | 读取技能文件 |
| `PUT` | `/api/skills/{id}/{file}` | 更新技能文件 |
| `DELETE` | `/api/skills/{id}` | 删除技能目录 |
| `GET` | `/api/config` | 脱敏配置（敏感信息已隐藏） |
| `GET` | `/api/config/raw` | 原始配置（用于编辑） |
| `PUT` | `/api/config` | 保存配置 |
| `GET` | `/api/logs` | `.log` 文件列表 |
| `GET` | `/api/logs/{name}` | 读取日志尾部（`?lines=500`） |

## 数据路径

所有路径相对于 `NANOBOT_ROOT`：

| 数据 | 路径 | 格式 |
|------|------|------|
| 当前模型 | `.state.json` | `{"model": "...", "compact_model": "..."}` |
| 配置 | `config.json` | JSON（含敏感信息） |
| 定时任务 | `cron/jobs.json` | JSON，含 `version` + `jobs[]` |
| 会话 | `workspace/sessions/*.jsonl` | 第 1 行：元数据，其余：消息 |
| 会话备注 | `workspace/sessions/.notes.json` | `{key: note}` 映射 |
| 工作区文件 | `workspace/` | `.md` 文件，按子目录分组 |
| 知识库 | `workspace/knowledge/` | 软链接到外部目录 |
| 技能 | `workspace/skills/*/SKILL.md` | YAML frontmatter + Markdown |
| 日志 | `*.log` | 纯文本日志文件 |

## 安全设计

- **认证**：通过 `NANOBOT_DASHBOARD_TOKEN` 环境变量设置可选的 Bearer token
- **路径遍历防护**：`safe_resolve()` 使用 `os.path.normpath`（非 `Path.resolve()`）防止 `../` 逃逸，同时支持软链接
- **配置脱敏**：匹配敏感键名模式的值在只读视图中替换为 `***`
- **定时任务写入安全**：`fcntl.flock(LOCK_EX)` 防止与网关进程并发写入冲突
- **本地优先**：默认绑定 `127.0.0.1`

## 设计风格

深色主题，使用 CSS 自定义属性。Plus Jakarta Sans 用于界面文字，JetBrains Mono 用于代码。绿色主色调（`#4ADE80`），橙色高亮点缀。

## TODO

- [ ] 移动端体验优化 — 基础响应式布局已完成，细节待打磨
- [ ] 自动化测试 — 后端 API + 前端组件 + 端到端

## 许可证

MIT
