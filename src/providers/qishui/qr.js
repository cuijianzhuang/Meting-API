import crypto from 'crypto-browserify'
import { Buffer } from 'buffer/index.js'
import QRCode from 'qrcode'
import { closeQishuiSignerSession, signQishuiRequest } from './signer.js'

const API_BASE = 'https://api.qishui.com'
const AID = '386088'
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) SodaMusic/3.2.1 Chrome/136.0.7103.59 Electron/36.4.0 Safari/537.36'
const SESSION_TTL_MS = 10 * 60 * 1000
const MIN_CHECK_INTERVAL_MS = 2500
const sessions = new Map()

const text = (value) => typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim()

const qrError = (message, code = 'QISHUI_QR_ERROR') => {
    const error = new Error(message)
    error.code = code
    return error
}

const randomDigits = (length) => {
    let result = String((crypto.randomBytes(1)[0] % 8) + 1)
    while (result.length < length) result += String(crypto.randomBytes(1)[0] % 10)
    return result
}

const randomUuid = () => {
    const bytes = crypto.randomBytes(16)
    bytes[6] = (bytes[6] & 0x0f) | 0x40
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    const hex = Buffer.from(bytes).toString('hex')
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const randomBase64Url = (size) => Buffer.from(crypto.randomBytes(size))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const createSession = () => {
    const deviceId = randomDigits(16)
    const installId = randomDigits(15)
    return {
        sessionKey: randomUuid(),
        deviceId,
        installId,
        verifyPortraitId: `${randomUuid()}.login`,
        msToken: `${randomBase64Url(88)}==`,
        cookie: '',
        createdAt: Date.now(),
        lastCheckAt: 0,
        cooldownUntil: 0,
        lastResult: null,
        checkPromise: null,
    }
}

const cleanupSessions = () => {
    const cutoff = Date.now() - SESSION_TTL_MS
    for (const [token, session] of sessions) {
        if (session.createdAt < cutoff) {
            sessions.delete(token)
            void closeQishuiSignerSession(session.sessionKey)
        }
    }
}

const officialScanUrl = (indexUrl) => {
    const source = new URL(text(indexUrl))
    const token = text(source.searchParams.get('token'))
    if (!token) throw qrError('汽水二维码缺少登录 token', 'QISHUI_QR_TOKEN_MISSING')
    const target = new URL('https://bff-pc.qishui.com/light/invoke/scan_login')
    target.searchParams.set('token', token)
    target.searchParams.set('os', 'Windows')
    target.searchParams.set('computer_name', 'OpenMusic')
    return target.toString().replace(/\+/g, '%20')
}

const commonParams = (session) => ({
    passport_jssdk_version: '2.4.13',
    passport_jssdk_type: 'normal',
    is_from_ttaccountsdk: '1',
    aid: AID,
    language: 'zh',
    account_sdk_source: 'web',
    p_js_v: '2.4.13',
    p_js_t: 'pro',
    p_zt: '3.3.5',
    p_ver: '1.0.29',
    request_host: 'app%3A%2F%2Fresources',
    p_bd: '1.0.0.41',
    biz_trace_id: crypto.randomBytes(4).toString('hex'),
    is_new_login: '1',
    is_from_iesaccountsaas: '1',
    device_id: session.deviceId,
    install_id: session.installId,
    did: session.deviceId,
    iid: session.installId,
    device_platform: 'PC',
    version_code: '3.5.2',
    account_sdk_source_info: '00',
    msToken: session.msToken,
})

const buildUrl = (pathname, params) => {
    const url = new URL(pathname, API_BASE)
    for (const [key, value] of Object.entries(params)) {
        if (value != null) url.searchParams.set(key, String(value))
    }
    return url
}

const mergeCookies = (current, values) => {
    const pairs = new Map()
    const collect = (raw) => String(raw || '').split(/,(?=[^;,]+=)|;/).forEach((part) => {
        const index = part.indexOf('=')
        if (index <= 0) return
        const name = part.slice(0, index).trim()
        const value = part.slice(index + 1).trim().split(';')[0]
        if (name && !/^(path|domain|expires|max-age|samesite|secure|httponly)$/i.test(name)) pairs.set(name, value)
    })
    collect(current)
    if (Array.isArray(values)) values.forEach(collect)
    else collect(values)
    return [...pairs].map(([name, value]) => `${name}=${value}`).join('; ')
}

const collectResponseCookies = (response) => {
    if (typeof response.headers.getSetCookie === 'function') return response.headers.getSetCookie()
    return response.headers.get('set-cookie') || ''
}

const extractSessionId = (values) => {
    const list = Array.isArray(values) ? values : [values]
    for (const value of list) {
        const match = String(value || '').match(/(?:^|[;,]\s*)sessionid=([^;,\s]+)/i)
        if (match?.[1]) return match[1]
    }
    return ''
}

const cookieNames = (cookie) => String(cookie || '')
    .split(';')
    .map((item) => item.split('=', 1)[0].trim())
    .filter(Boolean)

const challengeSummary = (data = {}) => {
    const captcha = data?.captcha
    const descUrl = text(data?.desc_url || data?.descUrl)
    const redirectUrl = text(data?.redirect_url || data?.redirectUrl)
    const captchaText = typeof captcha === 'string' ? captcha : captcha && typeof captcha === 'object' ? JSON.stringify(captcha) : ''
    const challengeText = `${captchaText} ${descUrl} ${redirectUrl}`.toLowerCase()
    const safeUrl = (value) => {
        try {
            const url = new URL(value)
            return { host: url.hostname, path: url.pathname }
        } catch {
            return null
        }
    }
    const captchaInfo = captcha && typeof captcha === 'object' && !Array.isArray(captcha)
        ? { keys: Object.keys(captcha).slice(0, 20), type: text(captcha.type || captcha.verify_type || captcha.verifyType) }
        : { keys: [], type: '' }
    return {
        captchaPresent: Boolean(captchaText),
        captchaKind: /slide|slider|滑块/.test(challengeText)
            ? 'slider'
            : /verify|captcha|验证码|验证/.test(challengeText)
                ? 'captcha'
                : '',
        descUrlPresent: Boolean(descUrl),
        redirectUrlPresent: Boolean(redirectUrl),
        descUrl: safeUrl(descUrl),
        redirectUrl: safeUrl(redirectUrl),
        captchaType: captchaInfo.type,
        captchaKeys: captchaInfo.keys,
        responseDataKeys: Object.keys(data || {}).slice(0, 40),
        extraKeys: data?.extra && typeof data.extra === 'object' ? Object.keys(data.extra).slice(0, 20) : [],
    }
}

const requestPassport = async (session, method, pathname, params = {}, bodyValues = null) => {
    const url = buildUrl(pathname, { ...commonParams(session), ...params })
    const headers = {
        Accept: 'application/json, text/javascript',
        'User-Agent': USER_AGENT,
        'x-tt-passport-verify-portrait': session.verifyPortraitId,
        'x-tt-passport-trace-id': url.searchParams.get('biz_trace_id') || '',
    }
    if (session.cookie) headers.Cookie = session.cookie
    let body
    if (bodyValues) {
        body = new URLSearchParams(bodyValues).toString()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'
        headers['x-ss-stub'] = crypto.createHash('md5').update(body).digest('hex').toUpperCase()
    }
    const response = await signQishuiRequest({
        sessionKey: session.sessionKey,
        method,
        url: url.toString(),
        headers,
        body,
        msToken: session.msToken,
    })
    const responseCookies = Array.isArray(response.cookies)
        ? response.cookies.map(cookie => `${cookie.name}=${cookie.value}`)
        : []
    session.cookie = mergeCookies(
        session.cookie,
        responseCookies,
    )
    let payload
    try {
        payload = JSON.parse(response.body || '{}')
    } catch {
        throw qrError(`汽水登录接口返回无效数据（HTTP ${response.status}）`, 'QISHUI_QR_INVALID_RESPONSE')
    }
    return { payload, responseCookies }
}

export const createQishuiQr = async () => {
    cleanupSessions()
    const session = createSession()
    const { payload } = await requestPassport(session, 'GET', '/passport/web/get_qrcode/', {
        passport_jssdk_version: '2.4.13',
        passport_jssdk_type: 'normal',
        is_from_ttaccountsdk: '1',
        aid: AID,
        next: API_BASE,
        need_logo: 'false',
        need_short_url: 'false',
        is_new_login: '1',
    })
    const data = payload?.data || {}
    const token = text(data.token)
    const indexUrl = text(data.qrcode_index_url)
    const scanUrl = officialScanUrl(indexUrl)
    if (payload?.message !== 'success' || Number(data.error_code) !== 0 || !token) {
        throw qrError(text(data.description || payload?.message) || '汽水二维码生成失败', 'QISHUI_QR_CREATE_FAILED')
    }
    // 当前 qrcode_index_url 直接访问会返回 404，汽水 PC 登录流程需要
    // 通过 light/invoke/scan_login 入口跳转到有效的扫码确认页。
    const qrimg = await QRCode.toDataURL(scanUrl, { errorCorrectionLevel: 'M', margin: 2, width: 360 })
    sessions.set(token, session)
    return {
        platform: 'qishui',
        key: token,
        token,
        qrimg,
        qrurl: scanUrl,
        expireTime: Number(data.expire_time || 0),
        message: '请使用已登录的汽水音乐 App 扫码确认登录',
    }
}

export const checkQishuiQr = async (token) => {
    cleanupSessions()
    const key = text(token)
    const session = sessions.get(key)
    if (!session) throw qrError('汽水二维码会话已过期，请重新生成', 'QISHUI_QR_SESSION_EXPIRED')
    if (session.cooldownUntil > Date.now() && session.lastResult) {
        return session.lastResult
    }
    if (session.lastResult && Date.now() - session.lastCheckAt < MIN_CHECK_INTERVAL_MS) {
        return session.lastResult
    }
    if (session.checkPromise) return session.checkPromise

    session.checkPromise = (async () => {
      const { payload, responseCookies } = await requestPassport(session, 'POST', '/passport/web/check_qrconnect/', {}, {
        need_logo: 'false',
        need_short_url: 'false',
        is_frontier: 'true',
        token: key,
        is_new_login: '1',
        next: API_BASE,
      })
      const data = payload?.data || {}
      const errorCode = Number(data.error_code || 0)
      const rawStatus = text(data.status).toLowerCase()
      const diagnostic = {
          errorCode,
          rawStatus,
          description: text(data.description || payload?.message),
          cookieNames: cookieNames(session.cookie),
          challenge: challengeSummary(data),
      }
      console.info('[Qishui QR] 状态', JSON.stringify(diagnostic))
      const responseSessionId = extractSessionId(responseCookies)
      if (responseSessionId) {
          session.cookie = mergeCookies(session.cookie, `sessionid=${responseSessionId}`)
      }
      // Mineradio V6 bridge uses Passport status 3 as the confirmed state.
      const confirmed = rawStatus === '3'
          || rawStatus === 'confirmed'
          || rawStatus === 'success'
          || data.logged_in === true
          || data.loggedIn === true
          || Boolean(data.session_cookie)
          || Boolean(responseSessionId)
      if (errorCode === 2046) {
          throw qrError('本次登录触发了汽水安全验证，请重新生成二维码后再试', 'QISHUI_QR_SECOND_VERIFY_REQUIRED')
      }
      if (errorCode === 2) {
          const expired = { platform: 'qishui', status: 'expired', loggedIn: false, cookie: '' }
          session.lastResult = expired
          session.lastCheckAt = Date.now()
          sessions.delete(key)
          void closeQishuiSignerSession(session.sessionKey)
          return expired
      }
      if (rawStatus === 'expired' || rawStatus === 'expire' || rawStatus === 'timeout') {
          const expired = { platform: 'qishui', status: 'expired', loggedIn: false, cookie: '', message: '汽水二维码已过期，请重新生成' }
          session.lastResult = expired
          session.lastCheckAt = Date.now()
          sessions.delete(key)
          void closeQishuiSignerSession(session.sessionKey)
          return expired
      }
      // 汽水在扫码后短时间内经常返回 7（访问频繁）。这是临时限流，
      // 不能把扫码会话标记为失败，更不能让上层停止轮询。
      if (errorCode === 7 && !confirmed) {
          // 汽水在已扫码后会对轮询接口限流；继续高频请求只会延长限流窗口。
          session.cooldownUntil = Date.now() + 5 * 1000
          if (session.lastResult) return session.lastResult
          return {
              platform: 'qishui',
              status: 'waiting',
              loggedIn: false,
              cookie: '',
              retryAfterMs: 60000,
              message: '汽水正在确认登录，请稍候…',
          }
      }
      if (errorCode && errorCode !== 0 && !confirmed) {
          const message = text(data.description || payload?.message)
          if (/访问太频繁|操作频繁|请求频繁|too many|频率/i.test(message) && session.lastResult) {
              return session.lastResult
          }
          throw qrError(message || `汽水扫码失败（${errorCode}）`, 'QISHUI_QR_CHECK_FAILED')
      }
      if (confirmed) {
          const nestedAuth = data.auth && typeof data.auth === 'object' ? data.auth : {}
          const sessionCookie = [
              data.session_cookie,
              data.cookie,
              payload.session_cookie,
              payload.cookie,
              data.sessionid ? `sessionid=${data.sessionid}` : '',
              data.session_id ? `sessionid=${data.session_id}` : '',
              nestedAuth.sessionid ? `sessionid=${nestedAuth.sessionid}` : '',
              nestedAuth.session_id ? `sessionid=${nestedAuth.session_id}` : '',
          ].filter(Boolean)
          session.cookie = mergeCookies(session.cookie, sessionCookie)
          const cookie = session.cookie
          // 汽水 Passport 确认后常用 sessionid_ss 下发完整登录态，
          // 不能只按 sessionid 的精确名称判断，否则会把成功登录误报成 502。
          if (!/(?:^|;\s*)(?:sessionid|sessionid_ss|sid_guard|sid_tt)=/i.test(cookie)) {
              throw qrError('汽水扫码成功但未返回完整登录态，请重新扫码', 'QISHUI_QR_COOKIE_MISSING')
          }
          const result = { platform: 'qishui', status: 'confirmed', loggedIn: true, cookie, message: '登录成功', diagnostic }
          session.lastResult = result
          session.lastCheckAt = Date.now()
          sessions.delete(key)
          void closeQishuiSignerSession(session.sessionKey)
          return result
      }
      const status = rawStatus === '1'
          || rawStatus === 'scanned'
          || rawStatus === 'scan'
          || rawStatus === '已扫码'
          ? 'scanned'
          : 'waiting'
      const result = { platform: 'qishui', status, loggedIn: false, cookie: '', message: text(payload?.message), diagnostic }
      session.lastResult = result
      session.lastCheckAt = Date.now()
      return result
    })()
    try {
      return await session.checkPromise
    } catch (error) {
      const message = text(error?.message)
      if (/访问太频繁|操作频繁|请求频繁|too many|频率/i.test(message) && session.lastResult) return session.lastResult
      throw error
    } finally {
      session.checkPromise = null
    }
}
