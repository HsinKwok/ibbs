# 轻量化论坛系统

<div align="center">

一款现代化、轻量级的开源社区论坛系统（移植自 nacrbbs，全面运行于 Cloudflare）

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Nuxt](https://img.shields.io/badge/Nuxt-4.5%2B-00dc82.svg)
![Vue](https://img.shields.io/badge/Vue-3.5%2B-42b883.svg)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-f38020.svg)
![D1](https://img.shields.io/badge/Database-D1%20(SQLite)-4a90d9.svg)

</div>

如果这个项目对你有帮助，请给个 ⭐️ Star 支持一下！

- github项目地址：[https://github.com/HsinKwok/ibbs](https://github.com/HsinKwok/ibbs)
- gitee项目地址：[https://gitee.com/example/forum](https://gitee.com/example/forum)
- 演示站：[https://bbs.example.com/](https://bbs.example.com/)
- QQ：<your-qq>
- 微信：<your-wechat>
- QQ群：<your-qq-group>


本项目移植自 [nacrbbs](https://github.com/nacrcn/nacrbbs)，并保持其前后端分离架构：需要分别部署前端和后端服务，若您没有部署经验，可直接联系我帮忙搭建！

> 如果您有兴趣参与项目开发，欢迎联系我一起参与开发！若您有任何指点和改正意见，也欢迎提出！我们一起学习进步！

---

## 📌 项目简介

本系统是移植自 nacrbbs 的全新轻量化论坛系统，采用前后端分离架构，界面简洁美观，性能卓越。后端运行于 **Cloudflare Workers**（基于自研 fetch 路由适配层），数据层使用 **Cloudflare D1（SQLite）/ KV / R2**，前端基于 **Nuxt 4 + Vue 3** 构建，提供完整的社区论坛解决方案，适用于个人博客、企业社区、技术论坛等多种场景。

### 核心特性

- 🎨 **现代化 UI** - 精美的界面设计，简洁清爽的用户体验
- ⚡ **高性能架构** - Cloudflare Workers 边缘计算 + Nuxt 4 SSR，全球就近响应
- 🔐 **完善的安全体系** - Token 身份认证、权限管理、PBKDF2 / AES 数据加密、SSR 富文本消毒
- 💳 **支付系统** - 集成支付宝（RSA2）、微信支付 V3、易支付等多种支付方式
- 📊 **数据统计** - 丰富的后台数据可视化分析
- 📧 **邮件服务** - 基于 SMTP 的邮件通知与验证码功能
- 🔄 **缓存优化** - Cloudflare KV 缓存 + 前端请求并发去重，降低数据库压力
- 📱 **响应式设计** - 完美适配 PC 和移动端

---

## 🎬 界面展示

### 前台论坛

![前台界面](https://imgsbad.semoun.com/uploads/2026/01/18/696c9ac53670e.png)

---


## 🛠️ 技术栈


| 技术 | 说明 | 技术 | 说明 |
|------|------|------|------|
| Cloudflare Workers | 边缘运行时（nodejs_compat） | Nuxt 4 | Vue 3 服务端渲染框架 |
| 自研 fetch 路由 | Worker 请求路由适配层 | Vue 3 | 前端框架 |
| Cloudflare D1 | SQLite 关系型数据库 | Arco Design | UI 组件库 |
| Cloudflare KV | 键值缓存 | Pinia | 状态管理 |
| Cloudflare R2 | 对象存储（上传文件） | Monaco Editor | 代码编辑器 |
| SMTP | 邮件服务（cloudflare:sockets） | WangEditor | 富文本编辑器 |
| Web Crypto | Token 签名 / 加密 | ECharts | 数据可视化 |
| 支付宝 / 微信支付 V3 / 易支付 | 支付渠道 | DOMPurify | 富文本消毒 |



---

## 📦 快速开始

### 环境要求
- Node.js >= 18（用于运行 Wrangler CLI 与 Nuxt 构建）
- Cloudflare 账号（D1 / KV / R2 需在 Cloudflare 控制台或通过 Wrangler 创建）
- Wrangler CLI >= 3

### 安装步骤

#### 1. 克隆项目

```bash
git clone https://github.com/HsinKwok/ibbs.git
cd ibbs
```

#### 2. 安装依赖

```bash
# 后端依赖（@workermailer/smtp 等）
npm install

# 前端依赖
cd web
npm install
```

#### 3. 创建并初始化 D1 数据库

```bash
wrangler d1 create forum
# 按提示将返回的 database_id 填入 wrangler.local.toml 的 [[d1_databases]]
wrangler d1 execute forum --local --file=./d1_schema.sql    # 本地
wrangler d1 execute forum --remote --file=./d1_schema.sql   # 线上
```

#### 4. 配置 Cloudflare 绑定

仓库中的 `wrangler.toml` 是**脱敏占位模板**，真实资源 ID 不纳入版本库。先复制一份本地配置，再填入你自己的资源 ID：

```bash
cp wrangler.toml wrangler.local.toml
```

- `[[d1_databases]].database_id`：D1 数据库 ID
- `[[kv_namespaces]].id`：KV 命名空间 ID（`wrangler kv namespace create KV`）
- `[[r2_buckets]].bucket_name`：R2 存储桶名称（`wrangler r2 bucket create forum-uploads`）
- `[vars].R2_PUBLIC_URL`：R2 自定义公开域名（可留空，回退到 Worker 自身 origin）

#### 5. 配置密钥

在项目根目录 `.dev.vars`（本地）中配置 Token 签名密钥，线上使用 `wrangler secret put`：

```
ADMIN_TOKEN_SECRET="在此填入随机密钥"
USER_TOKEN_SECRET="在此填入随机密钥"
```

> 邮件 SMTP 配置在后台「邮件配置」页面维护，存于数据库，无需写入环境变量。

#### 6. 启动后端服务

```bash
wrangler dev -c wrangler.local.toml
```

后端服务默认运行在 `http://127.0.0.1:8787`

#### 7. 启动前端服务

```bash
cd web
# 前端 API 地址默认指向本地 Worker（http://127.0.0.1:8787），开箱即用；
# 如需指向其它后端，启动/构建时用环境变量 NUXT_PUBLIC_API_BASE 覆盖
npm run dev
```

前端（前台 + 后台）为单个 **Nuxt 4** 项目，默认运行在 `http://127.0.0.1:3000`，后台入口为 `/admin`。

#### 8. 构建并部署前端到 Cloudflare Workers

前端同样以 **Cloudflare Workers（SSR）** 为部署目标（`nitro.preset = cloudflare_module`）：

```bash
cd web
npm run build
```

构建完成后，nitro 会在 `.output/` 生成产物，其中 `.output/server/wrangler.json` 已包含入口（`main`）与静态资源绑定（`assets`）。直接部署：

```bash
cd .output/server
npx wrangler deploy
```

部署前通过环境变量 `NUXT_PUBLIC_API_BASE` 指向线上后端 API 地址（可在 Cloudflare 控制台为前端 Worker 配置 Variables，或写入 `web/wrangler.jsonc` 的 `vars`）。

默认后台账号：`admin` / 密码：`123456`（部署后请立即修改）

---

## 🚀 手动部署（生产环境）

前后端分离，需分别部署两个 Worker：**后端 Worker**（API + D1 / KV / R2）与 **前端 Worker**（Nuxt SSR）。以下命令默认在项目根目录执行。

### 一、前置准备

```bash
# 登录 Cloudflare（浏览器授权）
wrangler login
```

需要目标域名已接入本 Cloudflare 账号（Zone），否则 `custom_domain` 路由不会生效。

### 二、创建并绑定资源

```bash
wrangler d1 create forum                       # D1 数据库
wrangler kv namespace create KV                # KV 命名空间
wrangler r2 bucket create forum-uploads        # R2 存储桶（上传文件）
```

将命令返回的 `database_id`、KV `id` 与桶名填入本地配置 `wrangler.local.toml`（先执行 `cp wrangler.toml wrangler.local.toml`，该文件已被 `.gitignore` 忽略）：

```toml
[[d1_databases]]
binding = "DB"
database_name = "forum"
database_id = "<你的 database_id>"

[[kv_namespaces]]
binding = "KV"
id = "<你的 KV id>"

[[r2_buckets]]
binding = "R2"
bucket_name = "forum-uploads"
```

### 三、初始化数据库

```bash
wrangler d1 execute forum --local  --file=./d1_schema.sql   # 本地
wrangler d1 execute forum --remote --file=./d1_schema.sql   # 线上（生产）
```

`d1_schema.sql` 是本项目**唯一**的数据库脚本，已整合建表、种子数据、二级索引与用户标识触发器。

### 四、配置密钥与变量

Token 签名密钥通过 secret 注入，切勿写入仓库：

```bash
wrangler secret put ADMIN_TOKEN_SECRET
wrangler secret put USER_TOKEN_SECRET
```

本地开发可在根目录 `.dev.vars` 中设置同名变量：

```
ADMIN_TOKEN_SECRET="在此填入随机密钥"
USER_TOKEN_SECRET="在此填入随机密钥"
```

在 `wrangler.toml` 的 `[vars]` 中配置上传公开地址与跨域白名单：

```toml
[vars]
# R2 自定义公开域名；留空则回退到 Worker 自身 origin 提供文件
R2_PUBLIC_URL = ""
# 允许携带凭证的前端来源，逗号分隔（务必包含线上前端域名）
CORS_ORIGINS = "https://<你的前端域名>,http://localhost:3000"
```

> 邮件 SMTP 在后台「邮件配置」页面维护、存于数据库，无需环境变量。

### 五、部署后端 Worker

```bash
npm install
wrangler deploy -c wrangler.local.toml
```

后端自定义域名在 `wrangler.toml` 声明（Zone 需已接入本账号）：

```toml
[[routes]]
pattern = "api.<你的域名>"
custom_domain = true
```

> 路由组前缀为 `/api`，接口完整路径形如 `POST https://api.<你的域名>/api/GetCategory`。

### 六、构建并部署前端 Worker

前端为单个 Nuxt 4 项目（前台 + `/admin` 后台），同样部署到 Cloudflare Workers（SSR）。

```bash
cd web
npm install

# 先指定线上后端 API 地址再构建（该地址会被编译进产物）
# Windows PowerShell：
$env:NUXT_PUBLIC_API_BASE="https://api.<你的域名>"; npm run build
# macOS / Linux：
# NUXT_PUBLIC_API_BASE=https://api.<你的域名> npm run build
```

构建产物在 `.output/`，其中 `.output/server/wrangler.json` 由 nitro 生成（含入口与静态资源绑定）。部署：

```bash
npx wrangler --cwd .output deploy
# 等价：cd .output/server ; npx wrangler deploy
```

前端自定义域名在 `web/wrangler.jsonc` 声明：

```jsonc
"routes": [
  { "pattern": "<你的域名>",     "custom_domain": true },
  { "pattern": "www.<你的域名>", "custom_domain": true }
]
```

`web/public/` 下的静态文件（如 `class-icons/`、`avatars/`）会随构建打入产物，由前端 Worker 直接提供。

### 七、部署校验

```bash
# 后端接口
curl -X POST https://api.<你的域名>/api/GetCategory -H "Content-Type: application/json" -d '{"page":1,"pagesize":20}'

# 前端首页
curl -I https://<你的域名>/
```

### 八、上线后必做

- 登录后台（默认 `admin` / `123456`）并**立即修改管理员密码**；
- 补齐因脱敏未预置的配置：`n_payconfig` / `n_email_template` / `n_notices` 的种子数据未包含，需在后台重新录入。

---

## 📦 详细的图文教程

[论坛系统编译教程](https://bbs.example.com/threads/49)

[全开源论坛系统 - 宝塔面板搭建教程](https://bbs.example.com/threads/46)

## 📁 项目结构

```
ibbs/
├── app/                    # 后端核心代码（运行于 Cloudflare Workers）
│   ├── controller/        # 控制器层
│   │   ├── Admin/         # 管理员接口
│   │   ├── user/          # 用户接口
│   │   └── tourist/       # 游客接口
│   ├── imp/               # 核心实现（SqlFun / Redis / Auth / Hash / Tools 等）
│   ├── library/           # 第三方库封装（支付 / 邮件 / 微信）
│   ├── router/            # 路由注册与中间件（Ware）
├── web/                    # 前端代码（单个 Nuxt 4 项目，含前台与 /admin 后台）
│   ├── components/        # 公共组件
│   ├── composables/       # 组合式函数（useApiFetch / useList / useAdminTable 等）
│   ├── pages/             # 页面路由（index 前台 / admin 后台）
│   ├── stores/            # Pinia 状态
│   ├── plugins/           # Nuxt 插件
│   └── wrangler.jsonc     # 前端 Cloudflare Workers 部署配置
├── d1_schema.sql           # D1 数据库初始化脚本
├── worker.js               # Worker 入口与 fetch 路由适配层
└── wrangler.toml           # Cloudflare Workers / D1 / KV / R2 配置
```




## 📄 开源协议

本项目移植自 [nacrbbs](https://github.com/nacrcn/nacrbbs)，采用 [MIT](LICENSE) 协议开源

---


