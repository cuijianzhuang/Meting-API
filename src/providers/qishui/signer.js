import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const SECURITY_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'security')
const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
}

let browserPromise
let assetServerPromise
const pages = new Map()

const closeBrowserWhenIdle = async () => {
    if (pages.size > 0) return
    const pendingBrowser = browserPromise
    browserPromise = null
    if (pendingBrowser) {
        try {
            const browser = await pendingBrowser
            await browser.close()
        } catch {}
    }
    if (pages.size === 0 && assetServerPromise) {
        try {
            const { server } = await assetServerPromise
            await new Promise(resolve => server.close(() => resolve()))
        } catch {}
        assetServerPromise = null
    }
}

const executableCandidates = () => [
    process.env.QISHUI_CHROMIUM_PATH,
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.platform === 'win32' ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe' : '',
    process.platform === 'win32' ? 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' : '',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
].filter(Boolean)

const findExecutable = () => executableCandidates().find(candidate => fs.existsSync(candidate))

const startAssetServer = async () => {
    if (assetServerPromise) return assetServerPromise
    assetServerPromise = new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const name = path.basename(new URL(req.url, 'http://127.0.0.1').pathname) || 'security_host.html'
            const file = path.join(SECURITY_DIR, name)
            if (!file.startsWith(SECURITY_DIR) || !fs.existsSync(file)) {
                res.writeHead(404).end()
                return
            }
            res.writeHead(200, {
                'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
                'Cache-Control': 'no-store',
            })
            fs.createReadStream(file).pipe(res)
        })
        server.once('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const address = server.address()
            resolve({ server, url: `http://127.0.0.1:${address.port}/security_host.html` })
        })
    })
    return assetServerPromise
}

const getBrowser = async () => {
    if (browserPromise) return browserPromise
    const executablePath = findExecutable()
    if (!executablePath) throw new Error('未找到 Chrome/Chromium，请安装 chromium 或设置 QISHUI_CHROMIUM_PATH')
    browserPromise = puppeteer.launch({
        executablePath,
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            // Passport 在本地安全页发起跨站 XHR；阻断第三方 Cookie 会导致
            // 扫码状态成功但 sessionid 永远无法写入隔离浏览器会话。
            '--disable-features=IsolateOrigins,site-per-process,BlockThirdPartyCookies,ThirdPartyStoragePartitioning',
            '--disable-third-party-cookies',
        ],
    }).catch(error => {
        browserPromise = null
        throw error
    })
    return browserPromise
}

const getPage = async (sessionKey) => {
    if (pages.has(sessionKey)) return pages.get(sessionKey)
    const pagePromise = (async () => {
        const browser = await getBrowser()
        const context = await browser.createBrowserContext()
        const page = await context.newPage()
        const diagnostics = []
        page.on('console', message => diagnostics.push(`console:${message.type()}:${message.text()}`))
        page.on('pageerror', error => diagnostics.push(`pageerror:${error.message}`))
        page.on('requestfailed', request => diagnostics.push(`requestfailed:${request.url()}:${request.failure()?.errorText || ''}`))
        await page.setUserAgent(
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
            + '(KHTML, like Gecko) SodaMusic/3.2.1 Chrome/136.0.7103.59 Safari/537.36',
        )
        await page.setRequestInterception(true)
        page.on('request', request => {
            if (/\/obj\/rc-client-security\/web\/stable\/1\.0\.0\.41\/bdms\.js/i.test(request.url())) {
                request.respond({
                    status: 200,
                    contentType: 'text/javascript; charset=utf-8',
                    body: fs.readFileSync(path.join(SECURITY_DIR, 'bdms.js')),
                }).catch(() => {})
                return
            }
            request.continue().catch(() => {})
        })
        const assets = await startAssetServer()
        await page.goto(assets.url, { waitUntil: 'networkidle0', timeout: 30000 })
        try {
            await page.waitForFunction(() => Boolean(window.bdms), { timeout: 20000 })
        } catch {
            const state = await page.evaluate(() => ({
                glue: window._sdkGlueVersionMap,
                bdms: typeof window.bdms,
                traces: (window.__qishuiSecurityTrace || []).slice(-20),
            })).catch(() => ({}))
            throw new Error(`汽水安全组件初始化失败: ${JSON.stringify({ diagnostics: diagnostics.slice(-20), state })}`)
        }
        return { page, context }
    })().catch(error => {
        pages.delete(sessionKey)
        throw error
    })
    pages.set(sessionKey, pagePromise)
    return pagePromise
}

export const signQishuiRequest = async ({ sessionKey, method, url, headers, body, msToken }) => {
    const { page, context } = await getPage(sessionKey)
    await page.evaluate(token => {
        localStorage.setItem('xmst', token)
        localStorage.setItem('xmsty', token)
    }, msToken)
    const safeHeaders = { ...headers }
    delete safeHeaders.Cookie
    delete safeHeaders.cookie
    const response = await page.evaluate(async request => window.__qishuiRequest(request), {
        method,
        url,
        headers: safeHeaders,
        body: body ?? null,
        timeout: 180000,
    })
    if (!response || response.status < 200 || response.status >= 400) {
        throw new Error(`汽水登录接口 HTTP ${response?.status || 0}`)
    }
    const signedUrl = String(response.responseURL || '')
    const signed = new URL(signedUrl)
    if ((signed.searchParams.get('a_bogus') || '').length !== 44) {
        throw new Error('汽水安全签名生成失败：a_bogus 缺失')
    }
    return {
        status: response.status,
        body: response.body,
        signedUrl,
        // 登录完成后的 sessionid 可能由 Passport/抖音域名下发；限定
        // api.qishui.com 会导致扫码成功但拿不到完整登录态。
        cookies: await context.cookies(),
    }
}

export const requestQishuiSession = async (sessionKey, request) => {
    const { page, context } = await getPage(sessionKey)
    const target = new URL(String(request?.url || ''))
    const allowedHosts = new Set(['api.qishui.com', 'auth.zijieapi.com', 'bff-pc.qishui.com'])
    if (!allowedHosts.has(target.hostname)) throw new Error('汽水验证请求目标不受支持')
    const response = await page.evaluate(async value => window.__qishuiRequest(value), {
        method: String(request?.method || 'GET').toUpperCase(),
        url: target.toString(),
        headers: Object.fromEntries(Object.entries(request?.headers || {})
            .filter(([name]) => !/^(cookie|host|content-length|origin|referer)$/i.test(name))),
        body: request?.body == null ? null : String(request.body),
        timeout: 180000,
    })
    return {
        status: Number(response?.status) || 0,
        body: String(response?.body || ''),
        responseURL: String(response?.responseURL || target),
        headers: String(response?.headers || ''),
        cookies: await context.cookies(),
    }
}

export const readQishuiSecurityAsset = name => {
    const allowed = new Set(['security_host.html', 'react.js', 'react-dom.js', 'sdk-glue.js', 'bdms.js'])
    const filename = String(name || '')
    if (!allowed.has(filename)) throw new Error('汽水验证资源不存在')
    return {
        body: fs.readFileSync(path.join(SECURITY_DIR, filename)),
        contentType: MIME[path.extname(filename)] || 'application/octet-stream',
    }
}

export const closeQishuiSignerSession = async (sessionKey) => {
    const pending = pages.get(sessionKey)
    pages.delete(sessionKey)
    if (!pending) return
    try {
        const { context } = await pending
        await context.close()
    } catch {}
    await closeBrowserWhenIdle()
}
