/**
 * QQ 音乐 Cookie 续期
 *
 * 使用 QQConnectLogin.LoginServer / QQLogin（music.login.Login 会返回 104400）
 * 优先 refresh_token，失败再回退 musickey。
 * musicid 必须为数字：Cookie 里 uin 常为 o1234567890。
 */
import crypto from 'crypto'

const parseCookieString = (cookieString) => {
    if (!cookieString) return {}
    const cookies = {}
    cookieString.split(';').forEach((item) => {
        const idx = item.indexOf('=')
        if (idx === -1) return
        const key = item.slice(0, idx).trim()
        const value = item.slice(idx + 1).trim()
        if (key && value) cookies[key] = value
    })
    return cookies
}

const normalizeMusicId = (uin) => {
    if (!uin) return 0
    const digits = String(uin).replace(/\D/g, '')
    return parseInt(digits, 10) || 0
}

/** QQ musics.fcg 签名（zzb 算法） */
const getSign = (data) => {
    const str = typeof data === 'object' ? JSON.stringify(data) : String(data)
    const hash = crypto.createHash('md5').update(str).digest('hex')
    return (
        'zzb' +
        hash[21] + hash[4] + hash[9] + hash[26] +
        hash[16] + hash[20] + hash[27] + hash[30] +
        hash[18] + hash[11] + hash[3] + hash[2] +
        hash[1] + hash[7] + hash[6] + hash[25]
    )
}

const buildRefreshResult = (loginData, uin) => {
    const musicId = loginData.str_musicid || String(normalizeMusicId(uin)) || uin
    const updates = {
        uin: musicId,
        qqmusic_key: loginData.musickey,
        qm_keyst: loginData.musickey,
    }

    if (loginData.access_token) {
        updates.psrf_qqaccess_token = loginData.access_token
    }
    if (loginData.openid) {
        updates.psrf_qqopenid = loginData.openid
    }
    if (loginData.refresh_token) {
        updates.psrf_qqrefresh_token = loginData.refresh_token
    }
    if (loginData.expired_at) {
        updates.psrf_access_token_expiresAt = String(loginData.expired_at)
    }
    if (loginData.musickeyCreateTime) {
        updates.psrf_musickey_createtime = String(loginData.musickeyCreateTime)
    }

    const newCookie = Object.entries(updates)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${k}=${v}`)
        .join('; ')

    return {
        success: true,
        cookie: newCookie,
        musickey: loginData.musickey,
        refreshToken: loginData.refresh_token || null,
        accessToken: loginData.access_token || null,
        expire: loginData.expired_at || null,
    }
}

const extractLoginPayload = (result) => {
    // 兼容 req1 / req_0 / req
    return result?.req1 || result?.req_0 || result?.req || null
}

const callLoginApi = async (param, uin) => {
    const musicid = normalizeMusicId(uin)
    if (!musicid) {
        return { success: false, error: 'uin 无效，无法解析 musicid' }
    }

    const data = {
        comm: {
            g_tk: 5381,
            platform: 'yqq',
            ct: 24,
            cv: 0,
            uin: musicid,
        },
        req1: {
            module: 'QQConnectLogin.LoginServer',
            method: 'QQLogin',
            param: {
                expired_in: 7776000,
                musicid,
                ...param,
            },
        },
    }

    const headers = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Referer: 'https://y.qq.com/',
        Origin: 'https://y.qq.com',
        Cookie: `uin=o${musicid}`,
    }

    const tryEndpoints = async () => {
        let last = null

        // 1) musicu.fcg（可不带 sign）
        {
            const url =
                'https://u.y.qq.com/cgi-bin/musicu.fcg?data=' +
                encodeURIComponent(JSON.stringify(data))
            const res = await fetch(url, { headers })
            const result = await res.json()
            const payload = extractLoginPayload(result)
            if (payload?.data?.musickey) {
                return { result, payload, via: 'musicu' }
            }
            last = { result, payload, via: 'musicu' }
        }

        // 2) musics.fcg + sign（与 QQMusicApi 一致）
        {
            const sign = getSign(data)
            const url =
                `https://u6.y.qq.com/cgi-bin/musics.fcg?sign=${sign}&format=json&inCharset=utf8&outCharset=utf-8&data=` +
                encodeURIComponent(JSON.stringify(data))
            const res = await fetch(url, { headers })
            const result = await res.json()
            const payload = extractLoginPayload(result)
            if (payload?.data?.musickey) {
                return { result, payload, via: 'musics' }
            }
            last = { result, payload, via: 'musics' }
        }

        return last
    }

    const { payload, via } = await tryEndpoints()
    const code = payload?.code
    const loginData = payload?.data

    console.log(
        `[QQMusic Refresh] via=${via}, code=${code}, hasKey=${!!loginData?.musickey}, method=${param.refresh_token ? 'refresh_token' : 'musickey'}`,
    )

    if (loginData?.musickey) {
        return buildRefreshResult(loginData, uin)
    }

    const errorMsg = loginData?.errMsg || loginData?.errmsg || code || '未知错误'
    return {
        success: false,
        error: `Cookie刷新失败: ${errorMsg}`,
    }
}

/** 用现有 musickey 续期 */
export const refreshTencentCookie = async (cookieString) => {
    try {
        const cookie = parseCookieString(cookieString)
        // 微信登录账号的 uin 在 wxuin
        const uin = cookie.uin || cookie.wxuin || ''
        const qqmusic_key = cookie.qqmusic_key || cookie.qm_keyst || ''

        if (!uin || !qqmusic_key) {
            return {
                success: false,
                error: 'Cookie缺少必要的认证信息 (uin 或 qqmusic_key)',
            }
        }

        return await callLoginApi({ musickey: qqmusic_key }, uin)
    } catch (e) {
        console.error('[QQMusic Refresh] Error:', e)
        return {
            success: false,
            error: `刷新出错: ${e.message}`,
        }
    }
}

/** 用 refresh_token 续期 */
export const refreshTencentCookieByRefreshToken = async (refreshToken, uin) => {
    try {
        if (!refreshToken || !uin) {
            return {
                success: false,
                error: '缺少 refresh_token 或 uin',
            }
        }

        const result = await callLoginApi({ refresh_token: refreshToken }, uin)
        if (result.success && !result.refreshToken) {
            result.refreshToken = refreshToken
        }
        return result
    } catch (e) {
        console.error('[QQMusic Refresh] Error:', e)
        return {
            success: false,
            error: `刷新出错: ${e.message}`,
        }
    }
}

export default {
    refreshTencentCookie,
    refreshTencentCookieByRefreshToken,
}
