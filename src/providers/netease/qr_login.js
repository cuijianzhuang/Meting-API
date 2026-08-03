/**
 * 网易云扫码登录
 * 流程：创建 unikey → 生成二维码 URL → 轮询 check → 成功返回 Cookie
 *
 * 注意：803 成功态只会出现一次。并发轮询时后到的请求会变成 801，
 * 所以这里用「单飞 + 会话水位 + 成功缓存」避免前端回退到「等待扫码」。
 */
import encrypt from './crypto.js'
import { net_ease_anonymous_token } from './config.js'
import { customAlphabet } from 'nanoid/non-secure'

const nanoid = customAlphabet('1234567890abcdef', 32)

const UA =
    'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.1.20.203753'

/** key -> { phase: 'waiting'|'scanned'|'confirmed'|'expired', result?, inflight? } */
const neteaseQrSessions = new Map()

const parseSetCookie = (headers) => {
    const list = []
    if (typeof headers.getSetCookie === 'function') {
        for (const raw of headers.getSetCookie()) {
            const pair = String(raw).split(';')[0].trim()
            if (pair.includes('=')) list.push(pair)
        }
        return list
    }
    const single = headers.get('set-cookie')
    if (!single) return list
    for (const part of String(single).split(/,(?=\s*[A-Za-z_][\w-]*=)/)) {
        const pair = part.split(';')[0].trim()
        if (pair.includes('=')) list.push(pair)
    }
    return list
}

const mergeCookies = (current = [], incoming = []) => {
    const values = new Map()
    for (const cookie of [...current, ...incoming]) {
        const pair = String(cookie || '').trim()
        const name = pair.split('=', 1)[0]
        if (name && pair.includes('=')) values.set(name, pair)
    }
    return [...values.values()]
}

const createSessionCookies = () => [
    '__remember_me=true',
    `_ntes_nuid=${nanoid()}`,
    `NMTID=${nanoid()}`,
    'os=pc',
    'appver=3.1.20.203753',
    `MUSIC_A=${net_ease_anonymous_token}`,
]

const weapiPost = async (path, data, cookies = []) => {
    const payload = encrypt.weapi({ ...data, csrf_token: '' })
    const cleanPath = path.replace(/^\//, '').replace(/^api\//, '').replace(/^weapi\//, '')
    const url = `https://music.163.com/weapi/${cleanPath}`
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'User-Agent': UA,
            Accept: 'application/json, text/plain, */*',
            'Content-Type': 'application/x-www-form-urlencoded',
            Referer: 'https://music.163.com/',
            Origin: 'https://music.163.com',
            Cookie: cookies.join('; '),
        },
        body: new URLSearchParams(payload).toString(),
    })
    const body = await res.json()
    return { body, cookies: mergeCookies(cookies, parseSetCookie(res.headers)) }
}

const getSession = (key) => {
    let session = neteaseQrSessions.get(key)
    if (!session) {
        session = { phase: 'waiting', result: null, inflight: null, cookies: createSessionCookies() }
        neteaseQrSessions.set(key, session)
    }
    return session
}

const scannedResult = (body, code) => ({
    status: 'scanned',
    message: '已扫码，请在手机上确认',
    code,
    nickname: body?.nickname || '',
    avatarUrl: body?.avatarUrl || '',
})

/** 创建扫码会话，返回 unikey 与二维码内容 */
export const createNeteaseQrSession = async () => {
    const cookies = createSessionCookies()
    const { body, cookies: nextCookies } = await weapiPost('login/qrcode/unikey', { type: 3 }, cookies)
    const unikey = body?.unikey || body?.data?.unikey
    if (!unikey) {
        throw new Error(body?.message || body?.msg || '获取网易云二维码失败')
    }
    neteaseQrSessions.set(unikey, {
        phase: 'waiting',
        result: null,
        inflight: null,
        cookies: nextCookies,
    })
    const qrurl = `https://music.163.com/login?codekey=${unikey}`
    return {
        platform: 'netease',
        key: unikey,
        qrurl,
        message: '请使用网易云音乐 App 扫码',
    }
}

/**
 * 轮询扫码状态
 * 800 过期 / 801 等待 / 802 已扫待确认 / 803 成功（含 cookie）
 */
export const checkNeteaseQrSession = async (key) => {
    if (!key) {
        return { status: 'error', message: '缺少 key' }
    }

    const session = getSession(key)
    if (session.result?.status === 'confirmed') {
        return { ...session.result }
    }
    if (session.phase === 'expired' && session.result) {
        return { ...session.result }
    }
    if (session.inflight) {
        return session.inflight
    }

    session.inflight = (async () => {
        try {
            const response = await weapiPost('login/qrcode/client/login', {
                key,
                type: 3,
            }, session.cookies)
            session.cookies = response.cookies
            const { body, cookies } = response
            const code = Number(body?.code)

            if (code === 800) {
                const expired = { status: 'expired', message: '二维码已过期，请刷新', code }
                session.phase = 'expired'
                session.result = expired
                setTimeout(() => neteaseQrSessions.delete(key), 60_000)
                return expired
            }

            if (code === 803) {
                const cookieFromBody = typeof body?.cookie === 'string' ? body.cookie : ''
                const cookie = cookieFromBody || cookies.join('; ') || ''
                if (!cookie || (!cookie.includes('MUSIC_U') && !cookie.includes('MUSIC_A'))) {
                    // 成功码但没 cookie：保持 scanned，让前端继续提示确认/重试
                    session.phase = 'scanned'
                    return {
                        status: 'error',
                        message: '登录成功但未拿到有效 Cookie，请重试',
                        code,
                    }
                }
                const confirmed = {
                    status: 'confirmed',
                    message: '登录成功',
                    code,
                    cookie,
                    nickname: body?.nickname || '',
                    avatarUrl: body?.avatarUrl || '',
                }
                session.phase = 'confirmed'
                session.result = confirmed
                setTimeout(() => neteaseQrSessions.delete(key), 60_000)
                return confirmed
            }

            if (code === 802) {
                session.phase = 'scanned'
                return scannedResult(body, code)
            }

            if (code === 8821 || code === -462) {
                const risk = {
                    status: 'error',
                    message: body?.message || '网易云触发安全验证，请刷新二维码后重试',
                    code,
                    risk: body?.data || null,
                }
                session.phase = 'scanned'
                return risk
            }

            if (code === 801) {
                // 803 已被消费后网易常回 801；若本会话已扫过，不要回退成 waiting
                if (session.phase === 'scanned') {
                    return scannedResult(body, code)
                }
                return { status: 'waiting', message: '等待扫码', code }
            }

            // 未知 code：已扫过则继续 scanned，否则 waiting
            if (session.phase === 'scanned') {
                return scannedResult(body, code)
            }
            return {
                status: 'waiting',
                message: body?.message || body?.msg || '等待扫码',
                code,
            }
        } finally {
            session.inflight = null
        }
    })()

    return session.inflight
}
