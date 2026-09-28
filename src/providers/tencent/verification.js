import fs from 'node:fs'
import puppeteer from 'puppeteer-core'

const sessions = new Map()
let browserPromise

const getBrowser = () => {
    if (!browserPromise) {
        const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH || process.env.QISHUI_CHROMIUM_PATH || [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
            '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
        ].find(candidate => fs.existsSync(candidate))
        if (!executablePath) throw new Error('服务端未找到 Chrome/Chromium，请设置 PUPPETEER_EXECUTABLE_PATH')
        browserPromise = puppeteer.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] })
            .catch(error => { browserPromise = null; throw error })
    }
    return browserPromise
}

export const closeTencentVerification = async (id) => {
    const session = sessions.get(id)
    if (!session) return
    sessions.delete(id)
    clearTimeout(session.timer)
    await session.context.close()
    if (sessions.size === 0 && browserPromise) {
        const browser = await browserPromise
        browserPromise = null
        await browser.close()
    }
}

export const startTencentVerification = async (id, cookie, validUrl) => {
    const target = new URL(validUrl)
    if (target.protocol !== 'https:' || target.hostname !== 'c.y.qq.com') throw new Error('验证地址无效')
    await closeTencentVerification(id)
    const browser = await getBrowser()
    const context = await browser.createBrowserContext()
    try {
        const cookies = cookie.split(';').flatMap(item => {
            const separator = item.indexOf('=')
            if (separator < 1) return []
            const name = item.slice(0, separator).trim()
            return /^[\w-]+$/.test(name) ? [{ name, value: item.slice(separator + 1).trim(), domain: '.qq.com', path: '/', secure: true }] : []
        })
        if (!cookies.length) throw new Error('QQ 音乐 Cookie 为空')
        await context.setCookie(...cookies)
        const page = await context.newPage()
        await page.setViewport({ width: 400, height: 720, deviceScaleFactor: 1 })
        await page.goto(validUrl, { waitUntil: 'domcontentloaded', timeout: 20000 })
        const timer = setTimeout(() => { closeTencentVerification(id).catch(() => {}) }, 5 * 60 * 1000)
        timer.unref?.()
        sessions.set(id, { context, page, timer })
    } catch (error) {
        await context.close()
        if (sessions.size === 0) {
            browserPromise = null
            await browser.close()
        }
        throw error
    }
}

export const getTencentVerificationFrame = async (id) => {
    const session = sessions.get(id)
    if (!session) throw new Error('验证窗口已过期，请重新打开')
    return session.page.screenshot({ type: 'webp', quality: 75 })
}

export const sendTencentVerificationPointer = async (id, { type, x, y }) => {
    const session = sessions.get(id)
    if (!session) throw new Error('验证窗口已过期，请重新打开')
    if (!['down', 'move', 'up'].includes(type) || !Number.isFinite(x) || !Number.isFinite(y)) throw new Error('鼠标事件无效')
    await session.page.mouse.move(Math.max(0, Math.min(400, x)), Math.max(0, Math.min(720, y)))
    if (type === 'down') await session.page.mouse.down()
    if (type === 'up') await session.page.mouse.up()
}
