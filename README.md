# Meting-API

多平台音乐 API 服务，支持网易云音乐、QQ 音乐和汽水音乐，提供 Cookie 管理、会员歌曲播放、自动续期和监测通知功能。

**当前版本：3.1.0**

## 功能特性

- 三平台支持：网易云音乐、QQ 音乐、汽水音乐
- 汽水音乐：公开搜索、歌曲信息、歌词、加密音频解密代理、个性化漫游
- 汽水扫码登录：Meting 在 Linux/Node 环境直接生成官方二维码并维护登录会话
- 汽水扫码安全验证：支持将短信/手机号二次验证资源转发给前端完成认证
- 汽水歌单：支持通过歌单 ID 获取歌单详情和歌曲列表
- 高音质取链：`type=url` 支持多档 VIP/SVIP 音质，返回实际档位中文名，不可用时自动降级
- 网易云电台：节目列表、电台详情、单集详情、热门推荐、电台搜索
- 网易云私人漫游：`fm` 多模式（熟悉 / 探索 / AI DJ / 场景漫游等）
- Cookie 管理系统：支持手动添加网易、QQ、汽水 Cookie，提供增删改查、在线验证和 VIP 播放能力检测
- Cookie 选择优先级：房间账号 > 共享 SVIP > Meting 基础账号 > 共享 VIP/普通账号
- QQ 音乐 Cookie 自动刷新：支持 musickey 和 refresh_token 两种续期方式
- 汽水 Cookie 定时监测：自动验证登录态和会员状态；失效时自动通知，重新扫码或手动添加同备注 Cookie 会覆盖旧凭证
- Cookie 定时监测：可配置间隔自动检查，失效/VIP 丢失时自动通知
- Webhook 通知：兼容 Gotify、企业微信、钉钉、飞书等
- 2FA 双因素认证：TOTP 实现，兼容 Google Authenticator
- 用户与权限管理：多用户、角色区分、登录失败锁定
- 管理后台：功能完备的单页应用，响应式设计
- 多运行时部署：Node.js / Docker / Vercel / Cloudflare Workers
- Docker 多架构镜像：支持 amd64/arm64，GitHub Actions 自动构建发布
## API 支持矩阵

### 曲目

| 类型 | 说明 | `id` | 网易云 | QQ音乐 | 汽水音乐 |
|------|------|------|:---:|:---:|:---:|
| `song` | 单曲信息 | 歌曲 ID | ✅ | ✅ | ✅ |
| `playlist` | 歌单 | 歌单 ID | ✅ | ✅ | ✅ |
| `artist` | 歌手歌曲 | 歌手 ID | ✅ | ❌ | ❌ |

### 搜索

| 类型 | 说明 | `id` | 网易云 | QQ音乐 | 汽水音乐 |
|------|------|------|:---:|:---:|:---:|
| `search` | 单曲搜索 | 关键词 | ✅ | ✅ | ✅ |
| `search_playlist` | 歌单搜索 | 关键词 | ✅ | ✅ | ❌ |
| `search_dj` | 电台搜索 | 关键词 | ✅ | ❌ | ❌ |

### 电台（仅网易云）

| 类型 | 说明 | `id` |
|------|------|------|
| `dj` | 节目列表（可播放） | 电台 ID |
| `dj_detail` | 电台详情 | 电台 ID |
| `djprogram` | 单集详情（可播放） | 节目 ID |
| `dj_hot` | 热门 / 推荐电台 | `hot` 或 `recommend` |

> `dj_detail` / `dj_hot` / `search_dj` 返回列表的 `url` 会指向 `type=dj`。

### 私人漫游

| 类型 | 说明 | `id` |
|------|------|------|
| `fm` | 私人漫游 | 网易为模式；汽水可空 |

| `id` 模式 | 说明 |
|-----------|------|
| `DEFAULT` | 默认漫游 |
| `FAMILIAR` | 熟悉模式 |
| `EXPLORE` | 探索模式 |
| `aidj` | AI DJ |
| `SCENE_RCMD` / `SCENE_RCMD:FOCUS` 等 | 场景漫游（子模式：`EXERCISE` / `FOCUS` / `NIGHT_EMO`） |


### 媒体

| 类型 | 说明 | `id` | 网易云 | QQ音乐 | 汽水音乐 |
|------|------|------|:---:|:---:|:---:|
| `url` | 播放链接 | 歌曲 ID | ✅ | ✅ | ✅ |
| `lrc` | 歌词 | 歌曲 ID | ✅ | ✅ | ✅ |
| `pic` | 封面 | 歌曲 ID | ✅ | ✅ | ✅ |

### 音质（`quality`，仅 `type=url` 生效）

斜杠两侧为同义别名（如 `flac` = `lossless`）。会员不够或歌曲无该档资源时自动降级，`quality` 字段为**实际拿到**的档位中文名。

**会员边界**

| 平台 | VIP | SVIP / 超级会员 |
|------|-----|-----------------|
| 网易云 | 极高 / 无损 / 高解析度无损 / 高清臻音 | 沉浸环绕声 / 超清母带 / 杜比全景声 |
| QQ 音乐 | HQ高品质 / SQ无损品质 | 臻品全景声 / 臻品母带 |
| 汽水音乐 | 较高 / 高品质 / 无损 | 录音室 / 全景（需有效会员 Cookie 和歌曲资源） |

| quality | 网易云 | QQ音乐 | 汽水音乐 | 备注 |
|---------|--------|--------|----------|------|
| `128` / `standard` | 标准 | 标准品质 | 标准 | 默认 |
| `higher` | 较高 | ❌ | 较高 | 按平台资源自动降级 |
| `320` / `exhigh` | 极高 | HQ高品质 | 较高 | 会员和歌曲资源不足时自动降级 |
| `flac` / `lossless` | 无损 | SQ无损品质 | 无损 | 会员和歌曲资源不足时自动降级 |
| `studio` | ❌ | ❌ | 录音室 | 汽水最高档，需账号和歌曲支持 |
| `atmos` | ❌ | 臻品全景声 | 全景 | 汽水请求参数兼容 `spatial` / `hi_res` |
| `hires` | 高解析度无损 | ❌ | 曲目需有 Hi-Res；仅网易 VIP |
| `jyeffect` | 高清臻音 | ❌ | 仅网易 VIP |
| `sky` | 沉浸环绕声 | ❌ | 仅网易 SVIP |
| `jymaster` | 超清母带 | ❌ | 仅网易 SVIP |
| `dolby` | 杜比全景声 | ❌ | 仅网易 SVIP |
| `atmos` | ❌ | 臻品全景声 | 仅 QQ 超级会员 |
| `master` | ❌ | 臻品母带 | 仅 QQ 超级会员 |

`type=url` 默认返回 JSON：`{"url","quality"}`；播放器需要 302 直链时追加 `&redirect=1`。
## 地区限制

### 部署在国外

| 客户端访问地区 | 国内 | 国外 |
|:---:|:---:|:---:|
| 网易云 | ✅ | ✅ |
| QQ音乐 | ✅¹ | ❌ |

### 部署在国内

| 客户端访问地区 | 国内 | 国外 |
|:---:|:---:|:---:|
| 网易云 | ✅ | ✅ |
| QQ音乐 | ✅ | ❌ |

¹ 使用 JSONP，需要替换前端插件：
- `https://cdn.jsdelivr.net/npm/meting@2.0.1/dist/Meting.min.js` → `https://cdn.jsdelivr.net/npm/@xizeyoupan/meting@latest/dist/Meting.min.js`
- `https://unpkg.com/meting@2.0.1/dist/Meting.min.js` → `https://unpkg.com/@xizeyoupan/meting@latest/dist/Meting.min.js`

详见 [MetingJS](https://github.com/xizeyoupan/MetingJS)

## 快速开始

### 环境要求

- Node.js >= 18.0.0

### 手动部署

```bash
git clone https://github.com/wqqqqqq200/Meting-API.git
cd Meting-API
npm install
npm run start:node
```

或：

```bash
node.exe ./node.js
```

部署成功后访问 `http://localhost:3000` 查看文档，或 `http://localhost:3000/test` 验证 API。
### Docker 部署

镜像地址：[w3126197382/meting-api](https://hub.docker.com/r/w3126197382/meting-api)

```bash
docker pull w3126197382/meting-api:latest
docker run -d --name meting -p 3000:3000 w3126197382/meting-api:latest
```

持久化数据：

```bash
docker run -d --name meting \
  -p 3000:3000 \
  -v ./data:/app/data \
  w3126197382/meting-api:latest
```

自定义端口和用户：

```bash
docker run -d --name meting \
  -p 8080:8080 \
  -e PORT=8080 \
  -e UID=1000 \
  -e GID=1000 \
  -v ./data:/app/data \
  w3126197382/meting-api:latest
```

宝塔升级：拉取新镜像后重建容器，镜像填 `w3126197382/meting-api:latest`（或指定版本如 `3.1.0`），保留原有 `-v ...:/app/data` 挂载即可。

#### 发布 Docker 镜像

项目已配置 GitHub Actions（`.github/workflows/publish.yml`），推送到仓库后自动构建并推送到 [Docker Hub](https://hub.docker.com/r/w3126197382/meting-api)。

**方式一：打版本标签（推荐）**

```bash
npm run patch   # 3.1.0 → 3.1.1，并 push main + tag
# 或 npm run minor / npm run major
```

或手动：

```bash
git tag v3.1.1
git push origin v3.1.1
```

会发布 `w3126197382/meting-api:3.1.1`、`3.1` 等标签。

**方式二：推 main 分支**

```bash
git push origin main
```

会更新 `latest` 及短 commit 标签。

**方式三：手动触发**

GitHub → Actions → **Build and Push Docker Image** → Run workflow。

> 需在仓库 Secrets 中配置 `DOCKERHUB_USERNAME`、`DOCKERHUB_TOKEN`。
### Vercel 部署

<a href="https://vercel.com/import/project?template=https://github.com/wqqqqqq200/Meting-API"><img src="https://vercel.com/button" height="36"></a>
点击按钮后按提示操作即可。Vercel 部署时 `OVERSEAS` 自动设为 `1`。

> **注意**：Vercel/Cloudflare Workers 运行时不支持管理后台功能（依赖文件系统），仅提供基础 API 服务。

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3000` | 服务监听端口 |
| `OVERSEAS` | `false` | 海外模式。Vercel/Cloudflare 运行时自动设为 `true` |
| `ADMIN_PATH` | `admin` | 管理后台路径。如设为 `secret-admin`，则后台地址为 `/secret-admin` |
| `DATA_DIR` | `./data` | 数据存储目录 |
| `METING_COOKIE_ENCRYPTION_KEY` | 自动生成 | Cookie 加密主密钥，支持 32 字节 base64 或 64 位 hex；配置后不可随意更换 |
| `METING_COOKIE_KEY_FILE` | `DATA_DIR/cookie-encryption.key` | 未配置主密钥时自动生成的密钥文件位置 |
| `UID` | `1010` | Docker 容器用户 UID |
| `GID` | `1010` | Docker 容器用户 GID |
### 汽水扫码

汽水扫码已直接集成在 Meting 中，不需要额外服务或环境变量。Node/Linux 部署可通过 `/admin/qr/create` 和 `/admin/qr/check` 完成汽水音乐账号登录；请使用汽水音乐 App 扫码确认。

如果扫码后返回二次验证，前端可按以下流程完成验证：

1. 调用 `POST /admin/qr/qishui/verify/start` 初始化验证会话。
2. 通过 `GET /admin/qr/qishui/security/:asset` 获取验证页面所需资源。
3. 将验证页面请求转发到 `POST /admin/qr/qishui/request`。
4. 验证完成后调用 `POST /admin/qr/qishui/verify/complete`，再继续轮询 `/admin/qr/check`。

验证完成后会话会返回成功状态和登录 Cookie；验证资源及请求接口仅用于当前二维码会话，不应长期缓存。

### 手动添加汽水 Cookie

管理后台进入“Cookie 管理”并点击“添加 Cookie”，平台选择“汽水音乐”。Cookie 至少需要包含 `sessionid`、`sessionid_ss`、`sid_guard`、`uid_tt` 或 `passport_csrf_token` 中的有效登录字段。

也可以通过管理接口添加：

```bash
curl -X POST 'https://你的域名/admin/cookies' \
  -H 'Authorization: Bearer 你的API_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{"platform":"qishui","cookie":"sessionid=你的值; sessionid_ss=你的值","note":"汽水基础账号"}'
```

汽水 Cookie 可用于登录搜索、歌曲详情、播放地址和最近播放漫游。其中 `type=fm` 必须存在有效汽水登录 Cookie；该接口先返回歌曲候选，播放地址仍需通过 `type=url` 单独获取。

> 汽水当前登录态是会话 Cookie，Meting 没有可稳定使用的公开 `refresh_token` 续期接口，因此不能像 QQ 音乐一样后台无感刷新。系统会自动定时验证汽水 Cookie；验证失败会发送监测通知。重新扫码或手动添加新 Cookie 时使用相同备注，系统会自动覆盖旧 Cookie。

## 使用方法

### 前端插件集成

在导入 [MetingJS](https://github.com/xizeyoupan/MetingJS) 前添加：

```html
<script>
var meting_api='http://your-domain/api?server=:server&type=:type&id=:id&auth=:auth&r=:r&redirect=1';
</script>
```

> 列表里的播放链接会自动带 `redirect=1`（302 直链）。直接请求 `type=url` 默认返回 JSON（含音质中文名）；需要 302 时自行加 `redirect=1`。

### API 请求示例

**曲目**
```
# 网易云：获取歌单内歌曲列表
GET /api?server=netease&type=playlist&id=6907557348

# 网易云：获取单曲信息
GET /api?server=netease&type=song&id=254059

# QQ音乐：获取歌单内歌曲列表
GET /api?server=tencent&type=playlist&id=7326220405

# 汽水音乐：获取歌单详情和歌曲列表
GET /api?server=qishui&type=playlist&id=7397692920558452788
```

**搜索**
```
# 网易云：按关键词搜索单曲（id 填关键词）
GET /api?server=netease&type=search&id=风筝误

# 网易云：按关键词搜索歌单
GET /api?server=netease&type=search_playlist&id=流行

# 网易云：按关键词搜索电台（仅网易云）
GET /api?server=netease&type=search_dj&id=代码时间
```

**电台（仅网易云）**
```
# 获取电台节目列表（可播放；id = 电台 ID）
GET /api?server=netease&type=dj&id=336355127

# 获取单集节目详情（可播放；id = 节目 ID）
GET /api?server=netease&type=djprogram&id=1367665101

# 热门电台列表（id 固定写 hot）
GET /api?server=netease&type=dj_hot&id=hot
```

**漫游 / 媒体**
```
# 私人漫游 · 熟悉模式
GET /api?server=netease&type=fm&id=FAMILIAR

# 网易云 · 无损（默认 JSON）
GET /api?server=netease&type=url&id=254059&quality=lossless

# 网易云 · 高清臻音（需 VIP Cookie；无该档则降级）
GET /api?server=netease&type=url&id=254059&quality=jyeffect

# 网易云 · 高解析度无损（曲目需有 Hi-Res 资源，如 1456890009）
GET /api?server=netease&type=url&id=1456890009&quality=hires

# QQ · 臻品母带（需超级会员；不够则降级）
GET /api?server=tencent&type=url&id=0010BrWk2SucQr&quality=master

# 需要 302 直链时（播放器 / MetingJS）
GET /api?server=tencent&type=url&id=0010BrWk2SucQr&quality=flac&redirect=1

# QQ · 歌词（纯文本）
GET /api?server=tencent&type=lrc&id=0010BrWk2SucQr

# 汽水音乐 · 录音室音质
GET /api?server=qishui&type=url&id=汽水歌曲ID&quality=studio
```

### 响应格式

- `type=url`：默认 JSON，例如：
  ```json
  {
    "url": "https://...",
    "quality": "无损"
  }
  ```
  请求 `quality=jyeffect` 若平台静默降级，`quality` 会显示实际档位（如「无损」）。追加 `redirect=1` 时 302 到音频；以 `@` 开头时返回纯文本
- `type=pic`：302 重定向到图片 URL
- `type=lrc`：返回纯文本歌词（含翻译合并）
- 其他类型：返回 JSON 数组

## 管理后台

访问 `/{ADMIN_PATH}`（默认 `/admin`）进入管理后台。

默认账号密码：`admin` / `admin123`，**请登录后立即修改默认密码**。

### 功能模块

| 模块 | 功能 |
|------|------|
| 仪表盘 | Cookie 统计、有效 Cookie 数、用户数、操作记录 |
| Cookie 管理 | 增删改查、在线验证、QQ音乐刷新、获取教程 |
| Cookie 监测 | 定时检查、自动刷新、Webhook 通知、监测历史 |
| 用户管理 | 增删改查、角色分配（管理员专属） |
| 操作日志 | 所有操作记录查看 |
| 设置 | 个人资料、密码修改、后台路径修改、2FA 设置 |

### Cookie 获取方法

#### 网易云音乐

1. 登录 [music.163.com](https://music.163.com)
2. 按 F12 打开开发者工具
3. 切换到 Network 标签，刷新页面
4. 找到任意请求，复制请求头中的 Cookie 字段
5. 粘贴到管理后台的 Cookie 输入框

#### QQ音乐

1. 登录 [y.qq.com](https://y.qq.com)
2. 按 F12 打开开发者工具
3. 切换到 Application → Cookies → y.qq.com
4. 复制 `uin` 和 `qqmusic_key` 的值
5. 格式：`uin=你的uin; qqmusic_key=你的key`

> **提示**：QQ音乐的完整 Cookie（包含 `psrf_qqrefresh_token`）支持自动续期，建议复制所有字段。

### QQ音乐 Cookie 自动续期

系统支持 QQ音乐 Cookie 自动刷新，无需手动更新：

- **刷新方式**：优先使用 `refresh_token`，失败后回退到 `musickey`
- **触发条件**：Cookie 监测检测到 VIP 播放能力丢失时自动触发
- **手动刷新**：在 Cookie 管理页面点击「刷新」按钮
- **刷新后更新**：`qqmusic_key`、`qm_keyst`、`access_token`、`openid`、过期时间等字段

## Cookie 监测系统

### 功能

- 定时监测 Cookie 有效性（间隔 5 分钟 ~ 24 小时）
- 检测 VIP 播放能力丢失
- QQ音乐 Cookie 自动刷新续期
- Webhook 通知（Cookie 失效、VIP 丢失、刷新成功）

### 配置步骤

1. 登录管理后台 → Cookie 监测
2. 启用定时监测，设置检查间隔
3. 配置 Webhook 通知（可选）
4. 保存设置

### Webhook 消息格式

```json
{
  "title": "Cookie失效通知 - 网易云音乐",
  "message": "平台: 网易云音乐\n备注: VIP账号\n失效时间: 2024-01-15 18:30:00\n原因: Cookie已失效\n\n请及时更新Cookie以确保服务正常",
  "priority": 5
}
```

### 通知事件优先级

| 事件 | 优先级 |
|------|--------|
| Cookie 失效 | 5 |
| VIP 播放能力丢失 | 4 |
| Cookie 自动刷新成功 | 3 |

### 常用 Webhook 配置

#### Gotify（推荐）

1. 部署 Gotify 服务端
2. 创建应用，获取 Token
3. Webhook URL：`https://your-gotify-server/message?token=YOUR_TOKEN`

#### 企业微信

1. 群聊中添加机器人
2. 获取 Webhook 地址填入

#### 钉钉

1. 群聊中添加自定义机器人
2. 安全设置选择「自定义关键词」，添加「Cookie」
3. 获取 Webhook 地址填入

#### 飞书

1. 群聊中添加自定义机器人
2. 获取 Webhook 地址填入

### 自定义 Headers

如需添加认证头，在「自定义 Headers」中输入 JSON：

```json
{
  "Authorization": "Bearer your-token-here"
}
```

## 安全特性

| 特性 | 说明 |
|------|------|
| 登录失败锁定 | 连续 5 次失败后锁定 15 分钟 |
| 隐藏管理入口 | 通过 `ADMIN_PATH` 自定义后台路径 |
| 动态路径修改 | 管理员可在后台设置页面修改路径，重启生效 |
| 2FA 双因素认证 | TOTP 实现，兼容 Google Authenticator / Authy |
| 非 root 运行 | Docker 容器以 `meting` 用户运行 |

## 管理 API

### 认证

所有管理 API 需在请求头中携带认证信息：

```
X-Auth-Username: your-username
X-Auth-Token: your-token
```

### 端点列表

#### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/login` | 登录（支持 2FA） |
| POST | `/admin/logout` | 登出 |
| GET | `/admin/check` | 检查登录状态 |

#### Cookie 管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/cookies` | Cookie 列表（支持 `?platform=` 筛选） |
| GET | `/admin/cookies/:id` | Cookie 详情 |
| POST | `/admin/cookies` | 添加 Cookie，`platform` 支持 `netease`、`tencent`、`qishui` |
| PUT | `/admin/cookies/:id` | 更新 Cookie |
| DELETE | `/admin/cookies/:id` | 删除 Cookie |
| POST | `/admin/cookies/:id/verify` | 验证 Cookie |
| POST | `/admin/cookies/:id/refresh` | 刷新 QQ 音乐 Cookie |
| POST | `/admin/cookies/validate` | 在线验证（不保存） |

#### 扫码登录

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/admin/qr/create` | 创建网易云、QQ音乐或汽水音乐二维码会话 |
| POST | `/admin/qr/check` | 查询扫码会话状态并获取登录 Cookie |
| POST | `/admin/qr/qishui/verify/start` | 初始化汽水二次验证 |
| GET | `/admin/qr/qishui/security/:asset` | 获取汽水二次验证资源 |
| POST | `/admin/qr/qishui/request` | 转发汽水二次验证请求 |
| POST | `/admin/qr/qishui/verify/complete` | 完成汽水二次验证 |

#### 用户管理（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/users` | 用户列表 |
| POST | `/admin/users` | 添加用户 |
| PUT | `/admin/users/:username` | 更新用户 |
| DELETE | `/admin/users/:username` | 删除用户 |
| PUT | `/admin/profile` | 修改当前用户资料 |
| PUT | `/admin/password` | 修改当前用户密码 |

#### Cookie 监测（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/monitor` | 监测配置 |
| PUT | `/admin/monitor` | 更新监测配置 |
| GET | `/admin/monitor/status` | 运行状态 |
| POST | `/admin/monitor/check` | 立即检查 |
| GET | `/admin/monitor/logs` | 监测日志 |

#### Webhook（管理员）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/webhook` | Webhook 配置 |
| PUT | `/admin/webhook` | 更新配置 |
| POST | `/admin/webhook/test` | 测试发送 |

#### 2FA

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/2fa/status` | 2FA 状态 |
| POST | `/admin/2fa/setup` | 初始化设置 |
| POST | `/admin/2fa/enable` | 启用 2FA |
| POST | `/admin/2fa/disable` | 禁用 2FA |

#### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin/logs` | 操作日志 |
| GET | `/admin/config` | 系统配置（管理员） |
| PUT | `/admin/config/admin-path` | 修改后台路径（管理员） |

## 反向代理

### Nginx

```nginx
server {
    listen 8099;
    server_name localhost;

    location /meting/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header X-Forwarded-Host $scheme://$host:$server_port/meting;
    }
}
```

### Caddy

```
http://localhost:8099 {
    handle_path /meting* {
        reverse_proxy http://localhost:3000 {
            header_up X-Forwarded-Host {scheme}://{host}:{port}/meting
        }
    }
}
```

### SSL 配置

#### Nginx

```nginx
server {
    listen 8099 ssl;
    server_name localhost;

    ssl_certificate     ../server.crt;
    ssl_certificate_key ../server.key;
    ssl_protocols TLSv1.2 TLSv1.3;

    location /meting/ {
        proxy_pass http://localhost:3000/;
        proxy_set_header X-Forwarded-Host $scheme://$host:$server_port/meting;
    }
}
```

#### Caddy

```
https://localhost:8099 {
    tls ./server.crt ./server.key
    handle_path /meting* {
        reverse_proxy http://localhost:3000 {
            header_up X-Forwarded-Host {scheme}://{host}:{port}/meting
        }
    }
}
```

## 常见问题

### 请求高音质却返回更低档位？

- 确认 Cookie 为对应平台 VIP / SVIP（或 QQ 超级会员）
- 确认**歌曲本身有该档资源**（如 `hires` 需曲目带 Hi-Res；测试曲 `254059` 有高清臻音但无 Hi-Res）
- 返回 JSON 中的 `quality` 已是实际档位，便于判断是否被平台降级

### QQ音乐无法播放？
- 确认部署在国内服务器
- 确认添加了有效的 VIP Cookie
- 尝试使用包含 `psrf_qqrefresh_token` 的完整 Cookie 以支持自动续期

### Cookie 刷新失败？

- 检查 Cookie 是否已完全过期（超过 90 天）
- 尝试重新登录获取新 Cookie
- 确保 Cookie 中包含 `psrf_qqrefresh_token` 字段

### Docker 数据持久化？

使用 `-v` 挂载数据目录：

```bash
docker run -d -p 3000:3000 -v ./data:/app/data w3126197382/meting-api:latest
```

### 忘记管理后台路径？

检查 `DATA_DIR/config.json` 中的 `adminPath` 字段，或通过环境变量 `ADMIN_PATH` 重新指定。

## 相关项目

- [MetingJS](https://github.com/xizeyoupan/MetingJS) - 前端音乐播放插件
- [Hono](https://github.com/honojs/hono) - Web 框架
- [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) - 网易云音乐 API
- [QQMusicApi](https://github.com/jsososo/QQMusicApi) - QQ 音乐 API

## License

MIT
