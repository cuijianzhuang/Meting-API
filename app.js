import api from './src/service/api.js'
import { handler } from './src/template.js'
import { adminPageHandler } from './src/admin/page.js'
import adminRoutes from './src/admin/api.js'
import store from './src/admin/store.js'
import cookieMonitor from './src/admin/cookie-monitor.js'
import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { cors } from 'hono/cors'
import config from './src/config.js'
import { get_runtime, get_url } from './src/util.js'
import { isQishuiRequestAbort, qishuiAudioResponse } from './src/providers/qishui/audio.js'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())

adminRoutes(app)

const getAdminPath = () => {
    const storedPath = store.getAdminPath()
    return storedPath || config.ADMIN_PATH
}

app.use('*', async (c, next) => {
    const adminPath = getAdminPath()
    const path = c.req.path
    
    if (path === '/' + adminPath || path.startsWith('/' + adminPath + '/')) {
        return adminPageHandler(c)
    }
    
    await next()
})

app.get('/api', api)
app.get('/audio/qishui', async (c) => {
    try {
        return await qishuiAudioResponse(c)
    } catch (error) {
        if (isQishuiRequestAbort(error, c.req.raw?.signal)) {
            // 浏览器切歌或重新请求 Range 时会主动关闭旧连接，不应伪装成播放失败。
            return new Response(null, { status: 499 })
        }
        console.error('[QishuiAudio]', error?.message || error)
        return c.json({ error: error?.message || 'qishui audio failed' }, 502)
    }
})
app.get('/test', handler)
app.get('/', (c) => {
    const baseUrl = get_url(c)
    return c.html(`<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Meting-API</title>
    <style>
        :root {
            --primary: #6366f1;
            --primary-light: #818cf8;
            --primary-dark: #4f46e5;
            --primary-bg: rgba(99,102,241,0.07);
            --success: #10b981;
            --success-bg: rgba(16,185,129,0.07);
            --warning: #f59e0b;
            --warning-bg: rgba(245,158,11,0.07);
            --danger: #ef4444;
            --text: #1e293b;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --bg: #f1f5f9;
            --bg-card: #ffffff;
            --border: #e2e8f0;
            --shadow-sm: 0 1px 3px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03);
            --shadow: 0 2px 8px rgba(0,0,0,0.06);
            --shadow-md: 0 4px 12px rgba(0,0,0,0.07);
            --radius: 10px;
            --radius-sm: 6px;
            --radius-lg: 14px;
            --transition: 0.2s cubic-bezier(0.4,0,0.2,1);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            background: var(--bg);
            min-height: 100vh;
            color: var(--text);
            -webkit-font-smoothing: antialiased;
            -webkit-tap-highlight-color: transparent;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .hero {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            background-size: 200% 200%;
            animation: gradientShift 8s ease infinite;
            width: 100%;
            align-self: stretch;
            padding: 80px 24px 64px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .hero::before {
            content: '';
            position: absolute;
            width: 500px;
            height: 500px;
            background: rgba(255,255,255,0.06);
            border-radius: 50%;
            top: -200px;
            right: -100px;
            animation: float 6s ease-in-out infinite;
        }
        .hero::after {
            content: '';
            position: absolute;
            width: 300px;
            height: 300px;
            background: rgba(255,255,255,0.04);
            border-radius: 50%;
            bottom: -100px;
            left: -80px;
            animation: float 8s ease-in-out infinite reverse;
        }
        .hero-content { position: relative; z-index: 1; max-width: 600px; margin: 0 auto; }
        .hero-icon { font-size: 56px; margin-bottom: 16px; animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1); }
        .hero h1 { font-size: 40px; font-weight: 800; color: #fff; letter-spacing: -1px; margin-bottom: 8px; animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .hero p { font-size: 16px; color: rgba(255,255,255,0.8); font-weight: 500; animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.2s both; }
        .badges { display: flex; justify-content: center; gap: 8px; margin-top: 20px; flex-wrap: wrap; animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .badges img { height: 22px; }
        .container { max-width: 960px; width: 100%; padding: 0 24px; margin-top: -32px; position: relative; z-index: 2; }
        .card {
            background: var(--bg-card);
            border-radius: var(--radius-lg);
            box-shadow: var(--shadow-md);
            border: 1px solid var(--border);
            padding: 28px 32px;
            margin-bottom: 20px;
            animation: fadeUp 0.5s cubic-bezier(0.16,1,0.3,1) 0.4s both;
        }
        .card-title {
            font-size: 15px;
            font-weight: 700;
            color: var(--text);
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 16px;
        }
        .info-item {
            padding: 14px 16px;
            background: var(--bg);
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            transition: var(--transition);
        }
        .info-item:hover { border-color: var(--primary); background: var(--primary-bg); }
        .info-label { font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
        .info-value { font-size: 14px; font-weight: 600; color: var(--text); word-break: break-all; }
        .info-value a { color: var(--primary); text-decoration: none; font-weight: 600; }
        .info-value a:hover { text-decoration: underline; }
        .links-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
        }
        .link-card {
            display: flex;
            align-items: center;
            gap: 14px;
            padding: 16px 20px;
            background: var(--bg);
            border-radius: var(--radius);
            border: 1px solid var(--border);
            text-decoration: none;
            color: var(--text);
            transition: var(--transition);
            min-height: 56px;
        }
        .link-card:hover { border-color: var(--primary); background: var(--primary-bg); transform: translateY(-2px); box-shadow: var(--shadow); }
        .link-icon { font-size: 24px; flex-shrink: 0; }
        .link-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
        .link-title { font-size: 14px; font-weight: 700; color: var(--text); }
        .link-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
        .link-arrow { color: var(--text-muted); font-size: 14px; transition: var(--transition); }
        .link-card:hover .link-arrow { color: var(--primary); transform: translateX(3px); }
        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            background: var(--success-bg);
            color: var(--success);
        }
        .status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: var(--success);
            animation: pulse 2s ease-in-out infinite;
        }
        footer {
            text-align: center;
            padding: 32px 24px;
            color: var(--text-muted);
            font-size: 13px;
        }
        footer a { color: var(--primary); text-decoration: none; }
        footer a:hover { text-decoration: underline; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-20px); } }
        @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 2px var(--success-bg); } 50% { box-shadow: 0 0 0 5px rgba(16,185,129,0.1); } }
        @media (max-width: 1024px) {
            .info-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
            .hero { padding: 48px 20px 40px; }
            .hero::before { width: 300px; height: 300px; top: -120px; right: -60px; }
            .hero::after { width: 200px; height: 200px; }
            .hero h1 { font-size: 28px; letter-spacing: -0.5px; }
            .hero p { font-size: 14px; }
            .hero-icon { font-size: 42px; }
            .card { padding: 20px 18px; border-radius: var(--radius); }
            .card-title { font-size: 14px; flex-wrap: wrap; }
            .info-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
            .info-item { padding: 12px; }
            .info-label { font-size: 10px; }
            .info-value { font-size: 13px; }
            .links-grid { grid-template-columns: 1fr; }
            .param-table th, .param-table td { padding: 8px 10px; }
            .code-block { padding: 14px 16px; }
            .code-block pre { font-size: 12px; }
            .api-endpoint { padding: 10px 12px; flex-wrap: wrap; }
            .api-path { font-size: 12px; word-break: break-all; margin-left: 0; margin-top: 6px; }
            .section-subtitle { font-size: 13px; }
            .support-grid { grid-template-columns: repeat(2, 1fr); }
            .container { margin-top: -24px; }
            .error-table th, .error-table td { padding: 8px 10px; }
            .tab-btn { padding: 6px 12px; font-size: 11px; }
        }
        @media (max-width: 480px) {
            .hero { padding: 36px 16px 32px; }
            .hero::before { width: 200px; height: 200px; top: -80px; right: -40px; }
            .hero::after { width: 150px; height: 150px; }
            .hero h1 { font-size: 24px; }
            .hero p { font-size: 13px; }
            .hero-icon { font-size: 36px; margin-bottom: 12px; }
            .badges { gap: 4px; margin-top: 14px; }
            .badges img { height: 18px; }
            .card { padding: 16px 14px; margin-bottom: 14px; }
            .card-title { font-size: 14px; margin-bottom: 14px; }
            .info-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
            .info-label { font-size: 10px; }
            .info-value { font-size: 12px; }
            .link-card { padding: 12px 14px; gap: 10px; }
            .link-icon { font-size: 20px; }
            .link-title { font-size: 13px; }
            .link-desc { font-size: 11px; }
            .param-table th, .param-table td { padding: 6px 8px; font-size: 11px; }
            .code-block { padding: 12px; }
            .code-block pre { font-size: 11px; line-height: 1.5; }
            .code-block .copy-btn { padding: 4px 8px; font-size: 10px; min-height: 24px; }
            .code-label { font-size: 11px; }
            .support-grid { grid-template-columns: 1fr 1fr; gap: 6px; }
            .support-item { padding: 8px 10px; font-size: 12px; }
            .container { padding: 0 12px; margin-top: -20px; }
            footer { padding: 20px 16px; font-size: 12px; }
            .api-method { font-size: 10px; padding: 2px 8px; }
            .api-path { font-size: 11px; }
            .section-subtitle { font-size: 12px; margin: 18px 0 10px; }
            .error-table th, .error-table td { padding: 6px 8px; font-size: 11px; }
        }
        @media (max-width: 360px) {
            .hero h1 { font-size: 20px; }
            .hero p { font-size: 12px; }
            .info-grid { grid-template-columns: 1fr; }
            .support-grid { grid-template-columns: 1fr; }
            .card { padding: 14px 12px; }
        }
        .api-method {
            display: inline-flex;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
        }
        .method-get { background: var(--success-bg); color: var(--success); }
        .api-path {
            font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
            font-size: 13px;
            font-weight: 600;
            color: var(--text);
            margin-left: 8px;
        }
        .api-endpoint {
            display: flex;
            align-items: center;
            padding: 12px 16px;
            background: var(--bg);
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            margin-bottom: 20px;
        }
        .param-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .param-table th {
            padding: 10px 14px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid var(--border);
            background: transparent;
        }
        .param-table td {
            padding: 10px 14px;
            border-bottom: 1px solid var(--border);
            color: var(--text);
            vertical-align: top;
        }
        .param-table tbody tr:last-child td { border-bottom: none; }
        .param-name {
            font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
            font-size: 12px;
            font-weight: 600;
            color: var(--primary);
        }
        .param-type { font-size: 11px; color: var(--text-muted); font-weight: 600; }
        .param-required { font-size: 11px; font-weight: 700; color: var(--danger); }
        .param-optional { font-size: 11px; font-weight: 600; color: var(--text-muted); }
        .param-default { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 11px; color: var(--text-secondary); }
        .code-block {
            position: relative;
            background: #1e293b;
            border-radius: var(--radius-sm);
            padding: 16px 20px;
            margin-bottom: 16px;
            overflow-x: auto;
        }
        .code-block pre {
            font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
            font-size: 13px;
            line-height: 1.6;
            color: #e2e8f0;
            white-space: pre;
            margin: 0;
        }
        .code-block .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            padding: 6px 12px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 4px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 600;
            cursor: pointer;
            transition: var(--transition);
            font-family: inherit;
            min-height: 28px;
        }
        .code-block .copy-btn:hover { background: rgba(255,255,255,0.2); color: #e2e8f0; }
        .code-block .copy-btn.copied { background: var(--success); color: #fff; border-color: var(--success); }
        .code-label {
            font-size: 12px;
            font-weight: 700;
            color: var(--text-secondary);
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .code-label .tag {
            display: inline-flex;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 10px;
            font-weight: 700;
        }
        .tag-json { background: var(--success-bg); color: var(--success); }
        .tag-text { background: var(--primary-bg); color: var(--primary); }
        .tag-redirect { background: var(--warning-bg); color: var(--warning); }
        .tag-vip {
            display: inline-flex;
            align-items: center;
            padding: 2px 7px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.4;
            margin: 1px 2px;
        }
        .tag-netease-vip { background: #e53935; color: #fff; }
        .tag-netease-svip { background: #212121; color: #fff; }
        .tag-qq-vip { background: #43a047; color: #fff; }
        .tag-qq-svip { background: #f5c518; color: #1a1a1a; }
        .tag-vip {
            display: inline-flex;
            align-items: center;
            padding: 2px 7px;
            border-radius: 3px;
            font-size: 11px;
            font-weight: 700;
            line-height: 1.4;
            margin: 1px 2px;
        }
        .tag-netease-vip { background: #e53935; color: #fff; }
        .tag-netease-svip { background: #1a1a1a; color: #fff; }
        .tag-qq-vip { background: #43a047; color: #fff; }
        .tag-qq-svip { background: #f5c518; color: #1a1a1a; }
        .section-subtitle {
            font-size: 14px;
            font-weight: 700;
            color: var(--text);
            margin: 24px 0 12px;
            display: flex;
            align-items: center;
            gap: 6px;
        }
        .support-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
            gap: 8px;
            margin-bottom: 20px;
        }
        .support-item {
            padding: 10px 14px;
            background: var(--bg);
            border-radius: var(--radius-sm);
            border: 1px solid var(--border);
            font-size: 13px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .support-item .check { color: var(--success); font-weight: 700; }
        .support-item .cross { color: var(--text-muted); }
        .error-table { width: 100%; border-collapse: collapse; font-size: 13px; display: block; overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .error-table th {
            padding: 10px 14px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 2px solid var(--border);
        }
        .error-table td {
            padding: 10px 14px;
            border-bottom: 1px solid var(--border);
            vertical-align: top;
        }
        .error-table tbody tr:last-child td { border-bottom: none; }
        .error-code { font-family: 'SF Mono', 'Fira Code', monospace; font-weight: 700; }
        .error-400 { color: var(--warning); }
        .error-403 { color: var(--danger); }
        .tabs { display: flex; gap: 2px; margin-bottom: 16px; background: var(--bg); border-radius: var(--radius-sm); padding: 3px; border: 1px solid var(--border); overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .tabs::-webkit-scrollbar { display: none; }
        .tab-btn {
            padding: 8px 16px;
            border: none;
            background: transparent;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            transition: var(--transition);
            font-family: inherit;
            white-space: nowrap;
            min-height: 32px;
        }
        .tab-btn:hover { color: var(--text); }
        .tab-btn.active { background: var(--bg-card); color: var(--primary); box-shadow: var(--shadow-sm); }
        .tab-content { display: none; }
        .tab-content.active { display: block; }
    </style>
</head>
<body>
    <div class="hero">
        <div class="hero-content">
            <div class="hero-icon">🎵</div>
            <h1>Meting API</h1>
            <p>多平台音乐 API 服务</p>
            <div class="badges">
                <a href="https://github.com/qq01-hub/Meting-API" style="text-decoration:none;">
                    <img alt="Github" src="https://img.shields.io/badge/Github-Meting-green">
                    <img alt="Forks" src="https://img.shields.io/github/forks/qq01-hub/Meting-API">
                    <img alt="Stars" src="https://img.shields.io/github/stars/qq01-hub/Meting-API">
                </a>
            </div>
        </div>
    </div>
    <div class="container">
        <div class="card">
            <div class="card-title">📊 服务状态 <span class="status-badge"><span class="status-dot"></span>运行中</span></div>
            <div class="info-grid">
                <div class="info-item">
                    <div class="info-label">版本</div>
                    <div class="info-value">3.1.0</div>
                </div>
                <div class="info-item">
                    <div class="info-label">运行环境</div>
                    <div class="info-value">${get_runtime()}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">内部端口</div>
                    <div class="info-value">${config.PORT}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">部署区域</div>
                    <div class="info-value">${config.OVERSEAS ? '海外' : '大陆'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">当前时间</div>
                    <div class="info-value">${new Date().toLocaleString('zh-CN')}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">实际地址</div>
                    <div class="info-value"><a href="${baseUrl}">${baseUrl}</a></div>
                </div>
            </div>
        </div>
        <div class="card" style="animation-delay: 0.5s;">
            <div class="card-title">🔗 快速导航</div>
            <div class="links-grid">
                <a class="link-card" href="${baseUrl}test">
                    <span class="link-icon">🎶</span>
                    <span class="link-info">
                        <span class="link-title">测试页面</span>
                        <span class="link-desc">在线播放器功能测试</span>
                    </span>
                    <span class="link-arrow">→</span>
                </a>
                <a class="link-card" href="${baseUrl}api">
                    <span class="link-icon">⚡</span>
                    <span class="link-info">
                        <span class="link-title">API 接口</span>
                        <span class="link-desc">音乐数据 API 服务</span>
                    </span>
                    <span class="link-arrow">→</span>
                </a>
                <a class="link-card" href="https://github.com/qq01-hub/Meting-API" target="_blank">
                    <span class="link-icon">📖</span>
                    <span class="link-info">
                        <span class="link-title">项目文档</span>
                        <span class="link-desc">GitHub 仓库与使用说明</span>
                    </span>
                    <span class="link-arrow">→</span>
                </a>
            </div>
        </div>
        <div class="card">
            <div class="card-title">📖 API 接口文档</div>

            <div class="api-endpoint">
                <span class="api-method method-get">GET</span>
                <span class="api-path">/api</span>
            </div>

<div class="section-subtitle">📋 请求参数</div>
            <table class="param-table">
                <thead>
                    <tr><th>参数名</th><th>类型</th><th>必填</th><th>默认值</th><th>说明</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><span class="param-name">server</span></td>
                        <td><span class="param-type">string</span></td>
                        <td><span class="param-optional">否</span></td>
                        <td><span class="param-default">netease</span></td>
                        <td><code>netease</code> / <code>tencent</code> / <code>qishui</code></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">type</span></td>
                        <td><span class="param-type">string</span></td>
                        <td><span class="param-optional">否</span></td>
                        <td><span class="param-default">playlist</span></td>
                        <td>见下方类型表</td>
                    </tr>
                    <tr>
                        <td><span class="param-name">id</span></td>
                        <td><span class="param-type">string</span></td>
                        <td><span class="param-optional">否</span></td>
                        <td><span class="param-default">6907557348</span></td>
                        <td>资源 ID 或关键词（随 type 变化）</td>
                    </tr>
                    <tr>
                        <td><span class="param-name">quality</span></td>
                        <td><span class="param-type">string</span></td>
                        <td><span class="param-optional">否</span></td>
                        <td><span class="param-default">standard</span></td>
                        <td>音质，仅影响播放链接</td>
                    </tr>
                </tbody>
            </table>

            <div class="section-subtitle">🎚️ 音质（quality）</div>
            <div style="font-size:13px;color:var(--text-secondary);margin-bottom:10px;line-height:1.7;">
                仅 <code>type=url</code> 生效。斜杠两侧为同义别名（如 <code>flac</code> = <code>lossless</code>）。会员不够或歌曲无该档时自动降级。<br>
                网易：高清臻音及以下多为 <span class="tag-vip tag-netease-vip">仅网易 VIP</span>，以上需 <span class="tag-vip tag-netease-svip">仅网易 SVIP</span>。<br>
                QQ：SQ / HQ 需 <span class="tag-vip tag-qq-vip">仅 QQ VIP</span>，臻品母带 / 臻品全景声需 <span class="tag-vip tag-qq-svip">仅 QQ SVIP</span>。<br>
                汽水：支持标准、高品质、无损；实际档位取决于歌曲资源和登录账号权限，暂无独立的汽水 SVIP 音质档。
            </div>
            <table class="param-table">
                <thead>
                    <tr><th>quality 参数值</th><th>网易云</th><th>QQ音乐</th><th>汽水音乐</th><th>备注</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><span class="param-name">128</span> / <span class="param-name">standard</span></td>
                        <td>标准</td>
                        <td>标准品质</td>
                        <td>标准</td>
                        <td>默认</td>
                    </tr>
                    <tr>
                        <td><span class="param-name">higher</span></td>
                        <td>较高</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="cross">✗</span></td>
                        <td>仅网易</td>
                    </tr>
                    <tr>
                        <td><span class="param-name">320</span> / <span class="param-name">exhigh</span></td>
                        <td>极高</td>
                        <td>HQ高品质</td>
                        <td>高品质</td>
                        <td>
                            <span class="tag-vip tag-netease-vip">仅网易 VIP</span>
                            <span class="tag-vip tag-qq-vip">仅 QQ VIP</span>
                        </td>
                    </tr>
                    <tr>
                        <td><span class="param-name">flac</span> / <span class="param-name">lossless</span></td>
                        <td>无损</td>
                        <td>SQ无损品质</td>
                        <td>无损</td>
                        <td>
                            <span class="tag-vip tag-netease-vip">仅网易 VIP</span>
                            <span class="tag-vip tag-qq-vip">仅 QQ VIP</span>
                        </td>
                    </tr>
                    <tr>
                        <td><span class="param-name">hires</span></td>
                        <td>高解析度无损</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="cross">✗</span></td>
                        <td>曲目需有 Hi-Res；<span class="tag-vip tag-netease-vip">仅网易 VIP</span></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">jyeffect</span></td>
                        <td>高清臻音</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="tag-vip tag-netease-vip">仅网易 VIP</span></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">sky</span></td>
                        <td>沉浸环绕声</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="tag-vip tag-netease-svip">仅网易 SVIP</span></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">jymaster</span></td>
                        <td>超清母带</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="tag-vip tag-netease-svip">仅网易 SVIP</span></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">dolby</span></td>
                        <td>杜比全景声</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="tag-vip tag-netease-svip">仅网易 SVIP</span></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">atmos</span></td>
                        <td><span class="cross">✗</span></td>
                        <td>臻品全景声</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="tag-vip tag-qq-svip">仅 QQ SVIP</span></td>
                    </tr>
                    <tr>
                        <td><span class="param-name">master</span></td>
                        <td><span class="cross">✗</span></td>
                        <td>臻品母带</td>
                        <td><span class="cross">✗</span></td>
                        <td><span class="tag-vip tag-qq-svip">仅 QQ SVIP</span></td>
                    </tr>
                </tbody>
            </table>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;line-height:1.7;">
                <code>type=url</code> 默认返回 JSON：<code>{"url","quality"}</code>（实际音质中文名）。需要 302 时追加 <code>&amp;redirect=1</code>。
            </div>

            <div class="section-subtitle">🔢 类型一览</div>
            <table class="param-table">
                <thead>
                    <tr><th>分类</th><th>type</th><th>id</th><th>netease</th><th>tencent</th><th>qishui</th></tr>
                </thead>
                <tbody>
                    <tr><td rowspan="3">曲目</td><td><span class="param-name">song</span></td><td>歌曲 ID</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="check">✓</span></td></tr>
                    <tr><td><span class="param-name">playlist</span></td><td>歌单 ID</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td><span class="param-name">artist</span></td><td>歌手 ID</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td rowspan="3">搜索</td><td><span class="param-name">search</span></td><td>关键词</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="check">✓</span></td></tr>
                    <tr><td><span class="param-name">search_playlist</span></td><td>关键词</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td><span class="param-name">search_dj</span></td><td>关键词</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td rowspan="4">电台</td><td><span class="param-name">dj</span></td><td>电台 ID</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td><span class="param-name">dj_detail</span></td><td>电台 ID</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td><span class="param-name">djprogram</span></td><td>节目 ID</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td><span class="param-name">dj_hot</span></td><td>hot / recommend</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td></tr>
                    <tr><td>漫游</td><td><span class="param-name">fm</span></td><td>模式（汽水可空）</td><td><span class="check">✓</span></td><td><span class="cross">✗</span></td><td><span class="check">✓</span></td></tr>
                    <tr><td rowspan="3">媒体</td><td><span class="param-name">url</span></td><td>歌曲 ID</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="check">✓</span></td></tr>
                    <tr><td><span class="param-name">lrc</span></td><td>歌曲 ID</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="check">✓</span></td></tr>
                    <tr><td><span class="param-name">pic</span></td><td>歌曲 ID</td><td><span class="check">✓</span></td><td><span class="check">✓</span></td><td><span class="check">✓</span></td></tr>
                </tbody>
            </table>

            <div class="section-subtitle">📨 请求示例</div>
            <div class="tabs">
                <button class="tab-btn active" onclick="switchTab(event, 'ex-music')">曲目</button>
                <button class="tab-btn" onclick="switchTab(event, 'ex-search')">搜索</button>
                <button class="tab-btn" onclick="switchTab(event, 'ex-dj')">电台</button>
                <button class="tab-btn" onclick="switchTab(event, 'ex-fm')">漫游</button>
                <button class="tab-btn" onclick="switchTab(event, 'ex-media')">媒体</button>
            </div>

            <div class="tab-content active" id="ex-music">
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre># 网易云：获取歌单内歌曲列表（返回 JSON）
${baseUrl}api?server=netease&type=playlist&id=6907557348

# 网易云：获取单曲信息（返回 JSON）
${baseUrl}api?server=netease&type=song&id=254059

# 网易云：获取歌手热门歌曲（返回 JSON）
${baseUrl}api?server=netease&type=artist&id=12441107

# QQ音乐：获取歌单内歌曲列表（返回 JSON）
${baseUrl}api?server=tencent&type=playlist&id=7326220405

# QQ音乐：获取单曲信息（返回 JSON）
${baseUrl}api?server=tencent&type=song&id=0010BrWk2SucQr

# 汽水音乐：获取单曲信息（返回 JSON）
${baseUrl}api?server=qishui&type=song&id=汽水歌曲ID</pre>
                </div>
            </div>

            <div class="tab-content" id="ex-search">
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre># 网易云：按关键词搜索单曲（id 填关键词）
${baseUrl}api?server=netease&type=search&id=风筝误

# 网易云：按关键词搜索歌单
${baseUrl}api?server=netease&type=search_playlist&id=流行

# 网易云：按关键词搜索电台（仅网易云）
${baseUrl}api?server=netease&type=search_dj&id=代码时间

# QQ音乐：按关键词搜索单曲
${baseUrl}api?server=tencent&type=search&id=风筝误

# QQ音乐：按关键词搜索歌单
${baseUrl}api?server=tencent&type=search_playlist&id=抖音热歌

# 汽水音乐：按关键词搜索单曲
${baseUrl}api?server=qishui&type=search&id=抖音热歌</pre>
                </div>
            </div>

            <div class="tab-content" id="ex-dj">
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre># 获取电台下的节目列表（可播放；id = 电台 ID）
${baseUrl}api?server=netease&type=dj&id=336355127

# 获取电台详情（封面、简介等；id = 电台 ID）
${baseUrl}api?server=netease&type=dj_detail&id=336355127

# 获取单集节目详情（可播放；id = 节目 ID）
${baseUrl}api?server=netease&type=djprogram&id=1367665101

# 热门电台列表（id 固定写 hot）
${baseUrl}api?server=netease&type=dj_hot&id=hot

# 推荐电台列表（id 固定写 recommend）
${baseUrl}api?server=netease&type=dj_hot&id=recommend</pre>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">仅网易云。<code>dj</code> / <code>djprogram</code> 可播放；其余列表项的 <code>url</code> 指向 <code>type=dj</code></div>
            </div>

            <div class="tab-content" id="ex-fm">
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre># 私人漫游 · 默认模式（不传 id 等同 DEFAULT）
${baseUrl}api?server=netease&type=fm

# 私人漫游 · 熟悉模式
${baseUrl}api?server=netease&type=fm&id=FAMILIAR

# 私人漫游 · 探索模式
${baseUrl}api?server=netease&type=fm&id=EXPLORE

# 私人漫游 · AI DJ
${baseUrl}api?server=netease&type=fm&id=aidj

# 私人漫游 · 场景模式（专注；还可换 EXERCISE / NIGHT_EMO）
${baseUrl}api?server=netease&type=fm&id=SCENE_RCMD:FOCUS

# 汽水音乐 · 个性化漫游（必须配置有效汽水登录 Cookie）
${baseUrl}api?server=qishui&type=fm</pre>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;line-height:1.7;">
                    模式：<code>DEFAULT</code>（可空）/ <code>FAMILIAR</code> / <code>EXPLORE</code> / <code>aidj</code> / <code>SCENE_RCMD</code><br>
                    网易场景子模式：<code>SCENE_RCMD:EXERCISE</code> / <code>FOCUS</code> / <code>NIGHT_EMO</code>。<br>
                    汽水漫游必须先配置有效汽水登录 Cookie，否则返回空列表。
                </div>
            </div>

            <div class="tab-content" id="ex-media">
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre># 网易云：获取播放链接 · 无损（flac 与 lossless 等价；302 跳转）
${baseUrl}api?server=netease&type=url&id=254059&quality=lossless

# 网易云：获取播放链接 · 超清母带（需 SVIP；不够会降级）
${baseUrl}api?server=netease&type=url&id=254059&quality=jymaster

# 网易云：获取播放链接 · 沉浸环绕声（需 SVIP；不够会降级）
${baseUrl}api?server=netease&type=url&id=254059&quality=sky

# 网易云：获取歌词（纯文本）
${baseUrl}api?server=netease&type=lrc&id=254059

# 网易云：获取封面（302 跳转）
${baseUrl}api?server=netease&type=pic&id=254059

# QQ音乐：获取播放链接 · 无损 FLAC（flac 与 lossless 等价）
${baseUrl}api?server=tencent&type=url&id=0010BrWk2SucQr&quality=flac

# QQ音乐：获取播放链接 · 臻品全景声（需 SVIP；不够会降级）
${baseUrl}api?server=tencent&type=url&id=0010BrWk2SucQr&quality=atmos

# QQ音乐：获取播放链接 · 臻品母带（需 SVIP；不够会降级）
${baseUrl}api?server=tencent&type=url&id=0010BrWk2SucQr&quality=master

# 需要 302 直链时（给播放器 / MetingJS）追加 redirect=1
${baseUrl}api?server=tencent&type=url&id=0010BrWk2SucQr&quality=flac&redirect=1

# 汽水音乐：获取播放链接、歌词和封面
${baseUrl}api?server=qishui&type=url&id=汽水歌曲ID&quality=lossless
${baseUrl}api?server=qishui&type=lrc&id=汽水歌曲ID
${baseUrl}api?server=qishui&type=pic&id=汽水歌曲ID</pre>
                </div>
            </div>

            <div class="section-subtitle">✅ 响应示例</div>
            <div class="tabs">
                <button class="tab-btn active" onclick="switchTab(event, 'tab-track')">曲目 JSON</button>
                <button class="tab-btn" onclick="switchTab(event, 'tab-list')">列表 JSON</button>
                <button class="tab-btn" onclick="switchTab(event, 'tab-url')">url / pic</button>
                <button class="tab-btn" onclick="switchTab(event, 'tab-lrc')">lrc</button>
            </div>

            <div class="tab-content active" id="tab-track">
                <div class="code-label">song / playlist / search / dj / djprogram / fm <span class="tag tag-json">JSON</span></div>
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre>[
  {
    "title": "歌曲名称",
    "author": "歌手名",
    "url": "${baseUrl}api?server=netease&type=url&id=xxx",
    "pic": "${baseUrl}api?server=netease&type=pic&id=xxx",
    "lrc": "${baseUrl}api?server=netease&type=lrc&id=xxx"
  }
]</pre>
                </div>
            </div>

            <div class="tab-content" id="tab-list">
                <div class="code-label">search_playlist / search_dj / dj_hot / dj_detail <span class="tag tag-json">JSON</span></div>
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre>[
  {
    "title": "名称",
    "author": "作者 / 主播",
    "pic": "https://example.com/cover.jpg",
    "id": "336355127",
    "url": "${baseUrl}api?server=netease&type=dj&id=336355127",
    "trackCount": 36
  }
]</pre>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;">歌单搜索的 <code>url</code> 指向 <code>type=playlist</code>；电台相关指向 <code>type=dj</code></div>
            </div>

            <div class="tab-content" id="tab-url">
                <div class="code-label">type=url 默认 JSON <span class="tag tag-json">JSON</span></div>
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre>{
  "url": "https://music.example.com/song.flac",
  "quality": "无损"
}</pre>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:8px;line-height:1.7;">
                    <code>quality</code> 为<strong>实际拿到</strong>的音质中文名（请求档不可用时会自动降级）。<br>
                    追加 <code>&amp;redirect=1</code> 时改为 302 跳转到 <code>url</code>（兼容播放器 / MetingJS）。<br>
                    url 以 <code>@</code> 开头时返回纯文本，不重定向。
                </div>
            </div>

            <div class="tab-content" id="tab-lrc">
                <div class="code-label">纯文本歌词 <span class="tag tag-text">Text</span></div>
                <div class="code-block">
                    <button class="copy-btn" onclick="copyCode(this)">复制</button>
                    <pre>[00:00.00] 作词 : 某某
[00:01.00] 作曲 : 某某
[00:10.50]第一行歌词</pre>
                </div>
            </div>

            <div class="section-subtitle">❌ 错误响应</div>
            <table class="error-table">
                <thead>
                    <tr><th>状态码</th><th>说明</th><th>示例</th></tr>
                </thead>
                <tbody>
                    <tr>
                        <td><span class="error-code error-400">400</span></td>
                        <td>server / type / quality 不合法</td>
                        <td><code>{"status":400,"message":"server 参数不合法",...}</code></td>
                    </tr>
                    <tr>
                        <td><span class="error-code error-403">403</span></td>
                        <td>无法获取播放链接</td>
                        <td><code>{"error":"no url"}</code></td>
                    </tr>
                </tbody>
            </table>

        </div>
    </div>
    <footer>Powered by <a href="https://github.com/qq01-hub/Meting-API" target="_blank">Meting-API</a></footer>
    <script>
    function copyCode(btn) {
        const pre = btn.parentElement.querySelector('pre');
        navigator.clipboard.writeText(pre.textContent).then(() => {
            btn.textContent = '已复制';
            btn.classList.add('copied');
            setTimeout(() => { btn.textContent = '复制'; btn.classList.remove('copied'); }, 1500);
        });
    }
    function switchTab(e, tabId) {
        const tabs = e.target.closest('.tabs');
        tabs.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        let el = tabs.nextElementSibling;
        while (el && !el.classList.contains('section-subtitle')) {
            if (el.classList && el.classList.contains('tab-content')) el.classList.remove('active');
            el = el.nextElementSibling;
        }
        document.getElementById(tabId).classList.add('active');
    }
    </script>
</body>
</html>`)
})

cookieMonitor.start()

export default app
