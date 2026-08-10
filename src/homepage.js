/**
 * 首页 / API 文档页
 */
export const renderHomepage = ({ baseUrl, runtime, port, overseas, version = '3.1.2' }) => `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Meting-API</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&display=swap" rel="stylesheet">
<style>
:root {
  --ink: #14121f;
  --ink-soft: #2a2640;
  --muted: #5c5770;
  --faint: #8b86a0;
  --line: rgba(20,18,31,.1);
  --paper: #f3f0ea;
  --card: rgba(255,255,255,.78);
  --accent: #ff4d6d;
  --accent-2: #00b4d8;
  --accent-3: #f4a261;
  --ok: #1a9b6c;
  --ok-soft: rgba(26,155,108,.12);
  --code: #171525;
  --mono: "IBM Plex Mono", ui-monospace, Consolas, monospace;
  --sans: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", sans-serif;
  --r: 16px;
  --shadow: 0 10px 40px rgba(20,18,31,.07);
}
* { box-sizing: border-box; margin: 0; padding: 0; }
html { scroll-behavior: smooth; }
body {
  font-family: var(--sans);
  font-synthesis: none;
  color: var(--ink);
  background: var(--paper);
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
  min-height: 100vh;
  overflow-x: hidden;
}
body::before {
  content: "";
  position: fixed; inset: 0; z-index: -2; pointer-events: none;
  background:
    radial-gradient(ellipse 80% 50% at 10% -10%, rgba(255,77,109,.22), transparent 55%),
    radial-gradient(ellipse 60% 45% at 95% 5%, rgba(0,180,216,.2), transparent 50%),
    radial-gradient(ellipse 50% 40% at 70% 90%, rgba(244,162,97,.16), transparent 55%),
    linear-gradient(180deg, #f7f4ee 0%, #efeae2 100%);
}
body::after {
  content: "";
  position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: .35;
  background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
  background-size: 180px;
  mix-blend-mode: multiply;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
code {
  font-family: var(--mono);
  font-size: .84em;
  background: rgba(255,255,255,.7);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: .12em .4em;
}

.top {
  position: sticky; top: 0; z-index: 50;
  background: rgba(243,240,234,.82);
  backdrop-filter: blur(14px) saturate(1.2);
  border-bottom: 1px solid var(--line);
}
.top-inner {
  max-width: 980px; margin: 0 auto; padding: 14px 22px;
  display: flex; align-items: center; justify-content: space-between; gap: 16px;
}
.brand { display: flex; align-items: center; gap: 10px; min-width: 0; }
.logo-mark {
  width: 34px; height: 34px; border-radius: 10px;
  background: linear-gradient(135deg, var(--accent), #ff8a5c 55%, var(--accent-2));
  display: grid; place-items: center;
  box-shadow: 0 6px 18px rgba(255,77,109,.35);
  flex-shrink: 0;
}
.logo-mark svg { width: 18px; height: 18px; }
.brand-text { display: flex; flex-direction: column; gap: 2px; line-height: 1.2; min-width: 0; }
.brand-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.brand-text strong {
  font-size: 16px; font-weight: 700; letter-spacing: 0;
}
.brand-ver {
  display: inline-flex; align-items: center;
  font-family: var(--mono); font-size: 11px; font-weight: 650;
  color: var(--ink-soft);
  background: rgba(255,255,255,.75);
  border: 1px solid var(--line);
  padding: 2px 8px; border-radius: 999px;
}
.brand-text .tagline { font-size: 11px; color: var(--faint); font-weight: 600; }
.nav { display: flex; gap: 4px; flex-wrap: wrap; }
.nav a {
  font-size: 13px; font-weight: 600; color: var(--muted);
  padding: 7px 11px; border-radius: 999px; text-decoration: none;
  transition: .2s ease;
}
.nav a:hover { color: var(--ink); background: rgba(255,255,255,.7); }
.live {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11px; font-weight: 700; color: var(--ok);
  background: var(--ok-soft); padding: 5px 10px; border-radius: 999px;
}
.live i {
  width: 7px; height: 7px; border-radius: 50%; background: var(--ok);
  animation: pulse 1.8s ease-in-out infinite;
}

.wrap { max-width: 980px; margin: 0 auto; padding: 28px 22px 56px; }

.hero {
  position: relative;
  border-radius: 28px;
  padding: 36px 36px 28px;
  margin-bottom: 28px;
  overflow: hidden;
  color: #fff;
  background:
    linear-gradient(145deg, #1a1730 0%, #241f3d 42%, #13283a 100%);
  box-shadow: 0 24px 60px rgba(20,18,31,.28);
  animation: rise .7s cubic-bezier(.16,1,.3,1) both;
}
.hero::before {
  content: "";
  position: absolute; inset: -20% auto auto -10%;
  width: 420px; height: 420px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,77,109,.45), transparent 68%);
  filter: blur(8px); pointer-events: none;
}
.hero::after {
  content: "";
  position: absolute; right: -8%; bottom: -30%;
  width: 360px; height: 360px; border-radius: 50%;
  background: radial-gradient(circle, rgba(0,180,216,.4), transparent 68%);
  filter: blur(6px); pointer-events: none;
}
.hero-grid {
  position: relative; z-index: 1;
  display: grid; grid-template-columns: 1.35fr .9fr; gap: 28px; align-items: end;
}
.hero-kicker {
  display: inline-flex; align-items: center; gap: 8px;
  font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: rgba(255,255,255,.65); margin-bottom: 14px;
}
.hero h1 {
  font-size: clamp(36px, 6vw, 52px);
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1.25;
  margin-bottom: 14px;
}
.hero h1 em {
  font-style: normal;
  letter-spacing: 0;
  background: linear-gradient(90deg, #ff8a5c, #ff4d6d 40%, #5ce1ff);
  -webkit-background-clip: text; background-clip: text; color: transparent;
}
.hero-lead {
  font-size: 15px; color: rgba(255,255,255,.72); max-width: 34rem; margin-bottom: 20px;
}
.platforms { display: flex; flex-wrap: wrap; gap: 8px; }
.plat {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 7px 12px; border-radius: 999px;
  background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.12);
  font-size: 12px; font-weight: 650; color: #fff;
}
.plat b { width: 8px; height: 8px; border-radius: 50%; }
.plat.ne b { background: #e74c3c; box-shadow: 0 0 10px #e74c3c; }
.plat.qq b { background: #2ecc71; box-shadow: 0 0 10px #2ecc71; }
.plat.qs b { background: #5ce1ff; box-shadow: 0 0 10px #5ce1ff; }

.hero-side { position: relative; z-index: 1; }
.eq {
  display: flex; align-items: flex-end; gap: 5px; height: 88px;
  margin-bottom: 18px; justify-content: flex-end;
}
.eq span {
  width: 7px; border-radius: 99px;
  background: linear-gradient(180deg, #5ce1ff, #ff4d6d);
  animation: eq 1.1s ease-in-out infinite;
  transform-origin: bottom;
}
.eq span:nth-child(1) { height: 28%; animation-delay: 0s; }
.eq span:nth-child(2) { height: 62%; animation-delay: .1s; }
.eq span:nth-child(3) { height: 44%; animation-delay: .2s; }
.eq span:nth-child(4) { height: 88%; animation-delay: .05s; }
.eq span:nth-child(5) { height: 36%; animation-delay: .25s; }
.eq span:nth-child(6) { height: 70%; animation-delay: .15s; }
.eq span:nth-child(7) { height: 52%; animation-delay: .3s; }
.eq span:nth-child(8) { height: 78%; animation-delay: .08s; }
.eq span:nth-child(9) { height: 40%; animation-delay: .22s; }
.eq span:nth-child(10) { height: 58%; animation-delay: .18s; }

.meta {
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
}
.meta div {
  background: rgba(255,255,255,.07);
  border: 1px solid rgba(255,255,255,.1);
  border-radius: 12px; padding: 10px 12px; backdrop-filter: blur(8px);
}
.meta dt { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.45); text-transform: uppercase; letter-spacing: .06em; }
.meta dd { font-size: 13px; font-weight: 650; margin-top: 2px; word-break: break-all; color: #fff; }
.meta dd a { color: #9eebff; }

.section {
  margin-bottom: 22px; scroll-margin-top: 80px;
  background: var(--card);
  border: 1px solid var(--line);
  border-radius: 22px;
  padding: 22px 24px 24px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
  animation: rise .65s cubic-bezier(.16,1,.3,1) both;
}
.section:nth-of-type(2) { animation-delay: .05s; }
.section:nth-of-type(3) { animation-delay: .1s; }
.section:nth-of-type(4) { animation-delay: .15s; }
.section:nth-of-type(5) { animation-delay: .2s; }
.section:nth-of-type(6) { animation-delay: .25s; }
.section h2 {
  font-size: 19px; font-weight: 700; letter-spacing: 0;
  line-height: 1.4;
  margin-bottom: 16px;
  display: flex; align-items: center; gap: 10px;
}
.section h2 .num {
  font-family: var(--mono); font-size: 11px; font-weight: 600;
  color: var(--accent); background: rgba(255,77,109,.1);
  border: 1px solid rgba(255,77,109,.2);
  padding: 4px 8px; border-radius: 999px;
}

.endpoint {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  background: linear-gradient(135deg, rgba(255,77,109,.08), rgba(0,180,216,.08));
  border: 1px solid var(--line);
  border-radius: 14px; padding: 14px 16px; margin-bottom: 16px;
}
.method {
  font-size: 11px; font-weight: 800; letter-spacing: .05em;
  color: #fff; background: linear-gradient(135deg, var(--ok), #14b8a6);
  padding: 5px 10px; border-radius: 8px;
  box-shadow: 0 6px 14px rgba(26,155,108,.25);
}
.path { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--ink-soft); }
.hint { font-size: 13px; color: var(--muted); margin: 0 0 12px; line-height: 1.7; }

.table-wrap {
  overflow-x: auto; border: 1px solid var(--line); border-radius: 14px;
  background: rgba(255,255,255,.55);
}
table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 560px; }
th, td { padding: 11px 13px; text-align: left; border-bottom: 1px solid var(--line); vertical-align: top; }
th {
  font-size: 11px; color: var(--faint); text-transform: uppercase; letter-spacing: .05em;
  background: rgba(20,18,31,.03); font-weight: 700;
}
tr:last-child td { border-bottom: none; }
tbody tr { transition: background .15s ease; }
tbody tr:hover { background: rgba(255,77,109,.04); }
.k { font-family: var(--mono); font-size: 12px; font-weight: 600; color: #c23a55; }
.y {
  display: inline-grid; place-items: center;
  width: 22px; height: 22px; border-radius: 7px;
  background: var(--ok-soft); color: var(--ok); font-weight: 800; font-size: 12px;
}
.n { color: var(--faint); font-weight: 600; }
.chip {
  display: inline-flex; align-items: center; font-size: 10px; font-weight: 750;
  padding: 2px 7px; border-radius: 999px; margin: 1px 2px; letter-spacing: .02em;
}
.chip-vip { background: #ffe4e6; color: #be123c; }
.chip-svip { background: #e7e5ef; color: #3b3558; }

.tabs {
  display: flex; gap: 4px; flex-wrap: wrap;
  background: rgba(20,18,31,.04);
  border: 1px solid var(--line); border-radius: 14px;
  padding: 5px; margin-bottom: 14px;
}
.tab {
  border: 0; background: transparent; cursor: pointer; font: inherit;
  font-size: 12px; font-weight: 700; color: var(--muted);
  padding: 8px 14px; border-radius: 10px; transition: .18s ease;
}
.tab:hover { color: var(--ink); }
.tab.on {
  background: #fff; color: var(--accent);
  box-shadow: 0 4px 14px rgba(20,18,31,.08);
}
.pane { display: none; animation: fade .25s ease; }
.pane.on { display: block; }

.code {
  position: relative;
  background: linear-gradient(160deg, #1b1830, #14111f 55%, #0f1c24);
  color: #e8e4f0; border-radius: 16px; padding: 18px 18px 16px;
  overflow-x: auto; border: 1px solid rgba(255,255,255,.06);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.05);
}
.code::before {
  content: ""; display: block; width: 42px; height: 8px; margin-bottom: 12px;
  background:
    radial-gradient(circle at 4px 4px, #ff5f57 3.2px, transparent 0),
    radial-gradient(circle at 18px 4px, #febc2e 3.2px, transparent 0),
    radial-gradient(circle at 32px 4px, #28c840 3.2px, transparent 0);
}
.code pre { font-family: var(--mono); font-size: 12.5px; line-height: 1.7; white-space: pre; margin: 0; }
.copy {
  position: absolute; top: 10px; right: 10px;
  border: 1px solid rgba(255,255,255,.14); background: rgba(255,255,255,.08);
  color: #c9c2d8; border-radius: 8px; padding: 5px 11px; font-size: 11px; font-weight: 700;
  cursor: pointer; font-family: inherit; transition: .15s ease;
}
.copy:hover { background: rgba(255,255,255,.16); color: #fff; }
.copy.ok { background: var(--ok); border-color: var(--ok); color: #fff; }

.note {
  margin-top: 12px; font-size: 13px; color: var(--ink-soft); line-height: 1.7;
  padding: 12px 14px;
  background: linear-gradient(135deg, rgba(255,77,109,.08), rgba(0,180,216,.08));
  border: 1px solid var(--line); border-radius: 12px;
}
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.card {
  display: block; color: inherit; text-decoration: none;
  background: linear-gradient(160deg, rgba(255,255,255,.9), rgba(255,255,255,.55));
  border: 1px solid var(--line); border-radius: 16px;
  padding: 18px 18px 16px; transition: .22s ease;
  position: relative; overflow: hidden;
}
.card::after {
  content: ""; position: absolute; right: -20px; top: -20px;
  width: 90px; height: 90px; border-radius: 50%;
  background: radial-gradient(circle, rgba(255,77,109,.18), transparent 70%);
}
.card:hover {
  transform: translateY(-3px);
  border-color: rgba(255,77,109,.35);
  box-shadow: 0 16px 36px rgba(20,18,31,.1);
  text-decoration: none;
}
.card h3 {
  font-size: 16px; font-weight: 700;
  letter-spacing: 0; line-height: 1.4; margin-bottom: 6px; position: relative; z-index: 1;
}
.card p { font-size: 13px; color: var(--muted); position: relative; z-index: 1; }

footer {
  text-align: center; color: var(--faint); font-size: 12px; padding: 8px 20px 40px;
}

@keyframes rise {
  from { opacity: 0; transform: translateY(18px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(26,155,108,.45); }
  50% { box-shadow: 0 0 0 6px rgba(26,155,108,0); }
}
@keyframes eq {
  0%, 100% { transform: scaleY(.45); }
  50% { transform: scaleY(1); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition: none !important;
  }
}
@media (max-width: 820px) {
  .hero-grid { grid-template-columns: 1fr; }
  .eq { justify-content: flex-start; }
  .hero { padding: 28px 22px 22px; border-radius: 22px; }
}
@media (max-width: 720px) {
  .grid-2 { grid-template-columns: 1fr; }
  .top-inner { flex-direction: column; align-items: flex-start; }
  .nav { width: 100%; }
  .section { padding: 18px 16px 18px; border-radius: 18px; }
  .meta { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 420px) {
  .meta { grid-template-columns: 1fr; }
  .hero h1 { font-size: 36px; }
}
</style>
</head>
<body>
<header class="top">
  <div class="top-inner">
    <div class="brand">
      <div class="logo-mark" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none"><path d="M9 18V6.4c0-.6.4-1.1 1-1.2l8-1.6c.8-.2 1.5.4 1.5 1.2V15" stroke="#fff" stroke-width="2" stroke-linecap="round"/><circle cx="7" cy="18" r="2.5" fill="#fff"/><circle cx="17" cy="15" r="2.5" fill="#fff"/></svg>
      </div>
      <div class="brand-text">
        <div class="brand-row">
          <strong>Meting-API</strong>
          <span class="brand-ver">v${version}</span>
        </div>
        <span class="tagline">multi-platform music API</span>
      </div>
      <span class="live"><i></i>在线</span>
    </div>
    <nav class="nav">
      <a href="#api">接口</a>
      <a href="#types">能力</a>
      <a href="#quality">音质</a>
      <a href="#examples">示例</a>
      <a href="${baseUrl}test">测试</a>
      <a href="https://github.com/qq01-hub/Meting-API" target="_blank" rel="noreferrer">GitHub</a>
    </nav>
  </div>
</header>

<main class="wrap">
  <section class="hero">
    <div class="hero-grid">
      <div>
        <div class="hero-kicker">♪ Frequency docs</div>
        <h1>听感统一<br>一份 <em>API</em></h1>
        <p class="hero-lead">网易云 · QQ · 汽水。Cookie 管理、会员音质、私人漫游，开箱即用。</p>
        <div class="platforms">
          <span class="plat ne"><b></b>网易云</span>
          <span class="plat qq"><b></b>QQ 音乐</span>
          <span class="plat qs"><b></b>汽水音乐</span>
        </div>
      </div>
      <div class="hero-side">
        <div class="eq" aria-hidden="true">
          <span></span><span></span><span></span><span></span><span></span>
          <span></span><span></span><span></span><span></span><span></span>
        </div>
        <dl class="meta">
          <div><dt>运行时</dt><dd>${runtime}</dd></div>
          <div><dt>端口</dt><dd>${port}</dd></div>
          <div><dt>区域</dt><dd>${overseas ? '海外' : '大陆'}</dd></div>
          <div><dt>地址</dt><dd><a href="${baseUrl}">${baseUrl}</a></dd></div>
        </dl>
      </div>
    </div>
  </section>

  <section class="section" id="api">
    <h2><span class="num">01</span>请求</h2>
    <div class="endpoint">
      <span class="method">GET</span>
      <span class="path">/api?server=&amp;type=&amp;id=&amp;quality=</span>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>参数</th><th>默认</th><th>说明</th></tr></thead>
        <tbody>
          <tr><td><span class="k">server</span></td><td><code>netease</code></td><td><code>netease</code> · <code>tencent</code> · <code>qishui</code></td></tr>
          <tr><td><span class="k">type</span></td><td><code>playlist</code></td><td>见下方能力矩阵</td></tr>
          <tr><td><span class="k">id</span></td><td>—</td><td>资源 ID / 搜索词 / 漫游模式（QQ 漫游忽略）</td></tr>
          <tr><td><span class="k">quality</span></td><td><code>standard</code></td><td>仅 <code>type=url</code></td></tr>
          <tr><td><span class="k">redirect</span></td><td>—</td><td><code>1</code> → <code>url</code>/<code>pic</code> 302</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="section" id="types">
    <h2><span class="num">02</span>能力矩阵</h2>
    <div class="table-wrap">
      <table>
        <thead><tr><th>type</th><th>id</th><th>网易</th><th>QQ</th><th>汽水</th></tr></thead>
        <tbody>
          <tr><td><span class="k">song</span></td><td>歌曲 ID</td><td><span class="y">✓</span></td><td><span class="y">✓</span></td><td><span class="y">✓</span></td></tr>
          <tr><td><span class="k">playlist</span></td><td>歌单 ID</td><td><span class="y">✓</span></td><td><span class="y">✓</span></td><td><span class="y">✓</span></td></tr>
          <tr><td><span class="k">artist</span></td><td>歌手 ID</td><td><span class="y">✓</span></td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td><span class="k">search</span></td><td>关键词</td><td><span class="y">✓</span></td><td><span class="y">✓</span></td><td><span class="y">✓</span></td></tr>
          <tr><td><span class="k">search_playlist</span></td><td>关键词</td><td><span class="y">✓</span></td><td><span class="y">✓</span></td><td class="n">—</td></tr>
          <tr><td><span class="k">search_dj</span></td><td>关键词</td><td><span class="y">✓</span></td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td><span class="k">dj</span> / <span class="k">dj_detail</span> / <span class="k">djprogram</span> / <span class="k">dj_hot</span></td><td>电台相关</td><td><span class="y">✓</span></td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td><span class="k">fm</span></td><td>见说明</td><td><span class="y">✓</span></td><td><span class="y">✓</span></td><td><span class="y">✓</span></td></tr>
          <tr><td><span class="k">url</span> / <span class="k">lrc</span> / <span class="k">pic</span></td><td>歌曲 ID</td><td><span class="y">✓</span></td><td><span class="y">✓</span></td><td><span class="y">✓</span></td></tr>
        </tbody>
      </table>
    </div>
    <div class="note">
      <strong>私人漫游：</strong>
      网易支持 <code>DEFAULT</code> / <code>FAMILIAR</code> / <code>EXPLORE</code> / <code>aidj</code> / <code>SCENE_RCMD[:FOCUS|EXERCISE|NIGHT_EMO]</code>。
      QQ <strong>不支持传模式</strong>（官方猜你喜欢固定接口，<code>id</code> 无效），需登录 Cookie。
      汽水需登录 Cookie。播放一律再请求 <code>type=url</code>。
    </div>
  </section>

  <section class="section" id="quality">
    <h2><span class="num">03</span>音质</h2>
    <p class="hint">仅 <code>type=url</code>。会员或曲目资源不足时自动降级；返回的 <code>quality</code> 是实际档位。汽水高档位需 SVIP，极高需 VIP。</p>
    <div class="table-wrap">
      <table>
        <thead><tr><th>quality</th><th>网易</th><th>QQ</th><th>汽水</th></tr></thead>
        <tbody>
          <tr><td><span class="k">128</span> / <span class="k">standard</span></td><td>标准</td><td>标准</td><td>标准</td></tr>
          <tr><td><span class="k">higher</span></td><td>较高</td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td><span class="k">320</span> / <span class="k">exhigh</span></td><td>极高 <span class="chip chip-vip">VIP</span></td><td>HQ <span class="chip chip-vip">VIP</span></td><td>极高 <span class="chip chip-vip">VIP</span></td></tr>
          <tr><td><span class="k">flac</span> / <span class="k">lossless</span></td><td>无损 <span class="chip chip-vip">VIP</span></td><td>SQ <span class="chip chip-vip">VIP</span></td><td>无损 <span class="chip chip-svip">SVIP</span></td></tr>
          <tr><td><span class="k">studio</span></td><td class="n">—</td><td class="n">—</td><td>录音室 <span class="chip chip-svip">SVIP</span></td></tr>
          <tr><td><span class="k">hires</span> / <span class="k">jyeffect</span></td><td>Hi-Res / 臻音 <span class="chip chip-vip">VIP</span></td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td><span class="k">sky</span> / <span class="k">jymaster</span> / <span class="k">dolby</span></td><td>环绕 / 母带 / 杜比 <span class="chip chip-svip">SVIP</span></td><td class="n">—</td><td class="n">—</td></tr>
          <tr><td><span class="k">atmos</span></td><td class="n">—</td><td>臻品全景声 <span class="chip chip-svip">超会</span></td><td>全景 <span class="chip chip-svip">SVIP</span></td></tr>
          <tr><td><span class="k">master</span></td><td class="n">—</td><td>臻品母带 <span class="chip chip-svip">超会</span></td><td class="n">—</td></tr>
        </tbody>
      </table>
    </div>
  </section>

  <section class="section" id="examples">
    <h2><span class="num">04</span>示例</h2>
    <div class="tabs" role="tablist">
      <button class="tab on" data-tab="ex-core" type="button">曲目</button>
      <button class="tab" data-tab="ex-search" type="button">搜索</button>
      <button class="tab" data-tab="ex-fm" type="button">漫游</button>
      <button class="tab" data-tab="ex-media" type="button">媒体</button>
      <button class="tab" data-tab="ex-resp" type="button">响应</button>
    </div>

    <div class="pane on" id="ex-core">
      <div class="code"><button class="copy" type="button">复制</button><pre># 网易云 · 获取歌单歌曲列表
${baseUrl}api?server=netease&type=playlist&id=6907557348

# 网易云 · 获取单曲信息
${baseUrl}api?server=netease&type=song&id=254059

# QQ 音乐 · 获取歌单歌曲列表
${baseUrl}api?server=tencent&type=playlist&id=7326220405

# 汽水音乐 · 获取歌单歌曲列表
${baseUrl}api?server=qishui&type=playlist&id=7397692920558452788</pre></div>
    </div>
    <div class="pane" id="ex-search">
      <div class="code"><button class="copy" type="button">复制</button><pre># 网易云 · 按关键词搜索单曲
${baseUrl}api?server=netease&type=search&id=风筝误

# QQ 音乐 · 按关键词搜索单曲
${baseUrl}api?server=tencent&type=search&id=风筝误

# 汽水音乐 · 按关键词搜索单曲
${baseUrl}api?server=qishui&type=search&id=抖音热歌

# 网易云 · 按关键词搜索歌单
${baseUrl}api?server=netease&type=search_playlist&id=流行

# 网易云 · 获取电台节目列表（id = 电台 ID）
${baseUrl}api?server=netease&type=dj&id=336355127</pre></div>
    </div>
    <div class="pane" id="ex-fm">
      <div class="code"><button class="copy" type="button">复制</button><pre># 网易云 · 私人漫游（默认模式）
${baseUrl}api?server=netease&type=fm

# 网易云 · 私人漫游 · 熟悉模式
${baseUrl}api?server=netease&type=fm&id=FAMILIAR

# 网易云 · 私人漫游 · 场景模式（专注）
${baseUrl}api?server=netease&type=fm&id=SCENE_RCMD:FOCUS

# QQ 音乐 · 猜你喜欢漫游（不支持模式，id 无效；需登录 Cookie）
${baseUrl}api?server=tencent&type=fm

# 汽水音乐 · 个性化漫游（需登录 Cookie）
${baseUrl}api?server=qishui&type=fm</pre></div>
      <div class="note">QQ 官方接口固定猜你喜欢，没有熟悉 / 探索等模式参数。</div>
    </div>
    <div class="pane" id="ex-media">
      <div class="code"><button class="copy" type="button">复制</button><pre># 网易云 · 获取播放链接（无损；返回 JSON）
${baseUrl}api?server=netease&type=url&id=254059&quality=lossless

# QQ 音乐 · 获取播放链接（臻品母带；需超会，不够会降级）
${baseUrl}api?server=tencent&type=url&id=0010BrWk2SucQr&quality=master

# QQ 音乐 · 获取播放链接并 302 跳转（给播放器 / MetingJS）
${baseUrl}api?server=tencent&type=url&id=0010BrWk2SucQr&quality=flac&redirect=1

# QQ 音乐 · 获取歌词（纯文本）
${baseUrl}api?server=tencent&type=lrc&id=0010BrWk2SucQr

# 汽水音乐 · 获取播放链接（录音室音质 · 需 SVIP）
${baseUrl}api?server=qishui&type=url&id=汽水歌曲ID&quality=studio</pre></div>
    </div>
    <div class="pane" id="ex-resp">
      <div class="grid-2">
        <div>
          <p class="hint" style="margin-bottom:8px">曲目列表 JSON · song / playlist / search / fm 等</p>
          <div class="code"><button class="copy" type="button">复制</button><pre># 返回歌曲数组；url / pic / lrc 为二次请求地址
[
  {
    "title": "歌名",
    "author": "歌手",
    "url": ".../api?server=...&type=url&id=...",
    "pic": ".../api?server=...&type=pic&id=...",
    "lrc": ".../api?server=...&type=lrc&id=..."
  }
]</pre></div>
        </div>
        <div>
          <p class="hint" style="margin-bottom:8px"><code>type=url</code> 默认 JSON</p>
          <div class="code"><button class="copy" type="button">复制</button><pre># quality 为实际拿到的音质中文名（可能已降级）
{
  "url": "https://.../song.flac",
  "quality": "无损"
}</pre></div>
          <div class="note" style="margin-top:10px">
            <code>pic</code> → 302 · <code>lrc</code> → 纯文本 ·
            非法参数 <strong>400</strong> · 无播放链 <strong>403</strong>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section">
    <h2><span class="num">05</span>更多</h2>
    <div class="grid-2">
      <a class="card" href="${baseUrl}test">
        <h3>在线测试 →</h3>
        <p>用内置播放器快速验证各平台接口。</p>
      </a>
      <a class="card" href="https://github.com/qq01-hub/Meting-API#readme" target="_blank" rel="noreferrer">
        <h3>完整 README →</h3>
        <p>部署、Cookie、后台、Webhook、地区限制。</p>
      </a>
    </div>
  </section>
</main>

<footer>Powered by <a href="https://github.com/qq01-hub/Meting-API" target="_blank" rel="noreferrer">Meting-API</a></footer>

<script>
document.querySelectorAll('.tabs').forEach(group => {
  group.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    const id = btn.dataset.tab;
    group.querySelectorAll('.tab').forEach(t => t.classList.toggle('on', t === btn));
    let el = group.nextElementSibling;
    while (el && el.classList.contains('pane')) {
      el.classList.toggle('on', el.id === id);
      el = el.nextElementSibling;
    }
  });
});
document.querySelectorAll('.copy').forEach(btn => {
  btn.addEventListener('click', () => {
    const pre = btn.parentElement.querySelector('pre');
    navigator.clipboard.writeText(pre.textContent).then(() => {
      btn.textContent = '已复制';
      btn.classList.add('ok');
      setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('ok'); }, 1200);
    });
  });
});
</script>
</body>
</html>`
