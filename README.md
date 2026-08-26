# Meting-API

多平台音乐 API · 网易云 / QQ / 汽水 · Cookie 管理 · 会员音质 · 私人漫游

**v3.1.3** · Node ≥ 18 · [Docker](https://hub.docker.com/r/w3126197382/meting-api) · MIT

---

## 快速开始

```bash
git clone https://github.com/qq01-hub/Meting-API.git
cd Meting-API && npm install && npm run start:node
```

| 入口 | 地址 |
|------|------|
| API 文档 | `http://localhost:3000` |
| 在线测试 | `http://localhost:3000/test` |
| 管理后台 | `http://localhost:3000/admin`（默认 `admin` / `admin123`，请立刻改密） |

```bash
docker run -d --name meting -p 3000:3000 -v ./data:/app/data w3126197382/meting-api:latest
```

---

## API 一览

```
GET /api?server={平台}&type={类型}&id={资源}&quality={音质}
```

| 参数 | 默认 | 说明 |
|------|------|------|
| `server` | `netease` | `netease` · `tencent` · `qishui` |
| `type` | `playlist` | 见下表 |
| `id` | — | 歌曲 / 歌单 ID，或搜索关键词 / 漫游模式 |
| `quality` | `standard` | 仅 `type=url` |
| `redirect` | — | `1` 时 `url`/`pic` 走 302 |

### 能力矩阵

| type | id | 网易 | QQ | 汽水 |
|------|----|:---:|:--:|:---:|
| `song` | 歌曲 ID | ✅ | ✅ | ✅ |
| `playlist` | 歌单 ID | ✅ | ✅ | ✅ |
| `artist` | 歌手 ID | ✅ | — | — |
| `search` | 关键词 | ✅ | ✅ | ✅ |
| `search_playlist` | 关键词 | ✅ | ✅ | — |
| `search_dj` | 关键词 | ✅ | — | — |
| `dj` / `dj_detail` / `djprogram` / `dj_hot` | 电台相关 | ✅ | — | — |
| `fm` | 见下方 | ✅ | ✅ | ✅ |
| `url` / `lrc` / `pic` | 歌曲 ID | ✅ | ✅ | ✅ |

### 私人漫游 `fm`

| 平台 | 模式 | 说明 |
|------|------|------|
| 网易云 | `DEFAULT` · `FAMILIAR` · `EXPLORE` · `aidj` · `SCENE_RCMD[:子模式]` | 子模式：`EXERCISE` / `FOCUS` / `NIGHT_EMO` |
| QQ 音乐 | **不支持传模式** | 固定猜你喜欢，`id` 无效；需登录 Cookie |
| 汽水 | 可空 / 平台自有偏好 | 需登录 Cookie |

播放地址一律再请求 `type=url`。

### 音质 `quality`

会员不足或曲目无该档时自动降级；响应里的 `quality` 是**实际档位**中文名。

| quality | 网易 | QQ | 汽水 |
|---------|------|----|------|
| `128` / `standard` | 标准 | 标准 | 标准 |
| `higher` | 较高 | — | — |
| `320` / `exhigh` | 极高 · VIP | HQ · VIP | 极高 · VIP |
| `flac` / `lossless` | 无损 · VIP | SQ · VIP | 无损 · SVIP |
| `studio` | — | — | 录音室 · SVIP |
| `hires` / `jyeffect` | Hi-Res / 臻音 · VIP | — | — |
| `sky` / `jymaster` / `dolby` | 环绕 / 母带 / 杜比 · SVIP | — | — |
| `atmos` | — | 臻品全景声 · 超会 | 全景 · SVIP |
| `master` | — | 臻品母带 · 超会 | — |

> 汽水：`studio` / `atmos` / `flac`·`lossless` 需 SVIP；`320`·`exhigh` 需 VIP。QQ 超会对应文档里的 SVIP 档。

---

## 示例

```bash
# 歌单 / 单曲 / 搜索
GET /api?server=netease&type=playlist&id=6907557348
GET /api?server=tencent&type=song&id=0010BrWk2SucQr
GET /api?server=qishui&type=search&id=风筝误

# 漫游
GET /api?server=netease&type=fm&id=FAMILIAR
GET /api?server=tencent&type=fm
GET /api?server=qishui&type=fm

# 媒体
GET /api?server=netease&type=url&id=254059&quality=lossless
GET /api?server=tencent&type=url&id=0010BrWk2SucQr&quality=master&redirect=1
GET /api?server=tencent&type=lrc&id=0010BrWk2SucQr
```

**响应**

- 曲目类 → JSON 数组 `{ title, author, url, pic, lrc, ... }`
- `url` → `{ "url", "quality" }`；加 `redirect=1` 则 302
- `pic` → 302 · `lrc` → 纯文本

### MetingJS

```html
<script>
  var meting_api = 'https://你的域名/api?server=:server&type=:type&id=:id&auth=:auth&r=:r&redirect=1'
</script>
```

海外部署 QQ 音乐请换用 [@xizeyoupan/meting](https://github.com/xizeyoupan/MetingJS)（JSONP）。

---

## 部署

| 场景 | 网易 | QQ（国内访问） | QQ（海外访问） |
|------|:---:|:---:|:---:|
| 服务在国内 | ✅ | ✅ | ❌ |
| 服务在海外 | ✅ | ✅¹ | ❌ |

¹ 海外服务端需 `OVERSEAS=1`（Vercel / Cloudflare 自动开启），并用上方 MetingJS fork。

| 变量 | 默认 | 说明 |
|------|------|------|
| `PORT` | `3000` | 端口 |
| `OVERSEAS` | `false` | 海外模式 |
| `ADMIN_PATH` | `admin` | 后台路径 |
| `DATA_DIR` | `./data` | 数据目录 |
| `METING_COOKIE_ENCRYPTION_KEY` | 自动 | Cookie 加密密钥，配置后勿随意更换 |

> Vercel / Cloudflare Workers **无管理后台**（无本地文件系统），仅提供基础 API。

---

## 管理后台

`/{ADMIN_PATH}` · Cookie 增删验证 · QQ 自动续期 · 汽水扫码 · 定时监测 · Webhook · 2FA · 多用户

**Cookie 要点**

- 网易：浏览器复制整段 Cookie
- QQ：至少 `uin` + `qqmusic_key`；含 `psrf_qqrefresh_token` 可自动续期
- 汽水：需 `sessionid` 等登录字段；无公开 refresh，靠监测 + 重新扫码（同备注会覆盖）

认证头：`X-Auth-Username` + `X-Auth-Token`（管理 API）。

---

## FAQ

**高音质被降级？** Cookie 会员等级不够，或曲目本身没有该档。看返回的 `quality`。

**QQ 播不了？** 客户端需能访问国内音源；检查 VIP Cookie；尽量带 refresh_token。

**Cookie 刷新失败？** 可能已彻底过期（约 90 天），重新登录。

**忘了后台路径？** 看 `DATA_DIR/config.json` 的 `adminPath`，或设 `ADMIN_PATH`。

---

## 相关

[MetingJS](https://github.com/xizeyoupan/MetingJS) · [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi) · [QQMusicApi](https://github.com/L-1124/QQMusicApi)

License: MIT
