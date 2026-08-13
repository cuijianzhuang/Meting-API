/**
 * QQ 音乐 App 原生扫码登录。
 * 流程：CreateQRCode → MQTT 推送扫码状态 → Login 换取 QQ 音乐 Cookie。
 */
import crypto from 'crypto'
import mqtt from 'mqtt'

const REQUEST_TIMEOUT_MS = 12000
const SESSION_EXPIRE_MS = 15 * 60 * 1000
const MOBILE_CT = 11
const MOBILE_CV = 14090008
const QR_CREATE_CV = 20030508
const QQ_MUSIC_UA = `QQMusic ${MOBILE_CV}(android 10)`
const WEB_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'

const QIMEI_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDEIxgwoutfwoJxcGQeedgP7FG9qaIuS0qzfR8gWkrkTZKM2iWHn2ajQpBRZjMSoSf6+KJGvar2ORhBfpDXyVtZCKpqLQ+FLkpncClKVIrBwv6PHyUvuCb0rIarmgDnzkfQAqVufEtR64iazGDKatvJ9y6B9NMbHddGSAUmRTCrHQIDAQAB
-----END PUBLIC KEY-----`
const QIMEI_SECRET = 'ZdJqM15EeO2zWc08'
const QIMEI_APP_KEY = '0AND0HD6FE4HY80F'
const QIMEI_CHANNEL_ID = '10003505'
const QIMEI_PACKAGE_ID = 'com.tencent.qqmusic'

const randomHex = (length) => crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length)
const randomDigits = (length) => Array.from({ length }, () => crypto.randomInt(0, 10)).join('')
const md5 = (...values) => crypto.createHash('md5').update(values.join('')).digest('hex')

const createDevice = () => {
    const build = crypto.randomInt(1_000_000, 10_000_000)
    const guid = crypto.randomUUID().replaceAll('-', '')
    return {
        androidId: randomHex(16),
        brand: 'Xiaomi',
        device: 'sagit',
        model: 'MI 6',
        imei: randomDigits(15),
        release: '10',
        sdk: '29',
        fingerprint: `xiaomi/iarim/sagit:10/eomam.200122.001/${build}:user/release-keys`,
        procVersion: `Linux 5.4.0-54-generic-${randomHex(8)} (android-build@google.com)`,
        guid,
        uid: '',
        sid: '',
        qimei: null,
        sessionPromise: null,
    }
}

const mobileDevice = createDevice()

const QQ_DEVICE_COOKIE_FIELD = 'psrf_qqdevice'

const encodeLoginDevice = (device, qimei) => Buffer.from(JSON.stringify({
    q16: qimei?.q16 || '',
    q36: qimei?.q36 || '',
    guid: device.guid || '',
    androidId: device.androidId || '',
    release: device.release || '',
    sdk: device.sdk || '',
    model: device.model || '',
    fingerprint: device.fingerprint || '',
}), 'utf8').toString('base64url')

const decodeLoginDevice = (value) => {
    try {
        const data = JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'))
        if (!data?.q16 || !data?.q36 || !data?.guid || !data?.androidId) return null
        return data
    } catch {
        return null
    }
}

const PART_1_INDEXES = [23, 14, 6, 36, 16, 7, 19]
const PART_2_INDEXES = [16, 1, 32, 12, 19, 27, 8, 5]
const SCRAMBLE_VALUES = [
    89, 39, 179, 150, 218, 82, 58, 252, 177, 52,
    186, 123, 120, 64, 242, 133, 143, 161, 121, 179,
]

const zzcSign = (payload) => {
    const hashHex = crypto.createHash('sha1').update(payload).digest('hex').toUpperCase()
    const part1 = PART_1_INDEXES.map((index) => hashHex[index]).join('')
    const part2 = PART_2_INDEXES.map((index) => hashHex[index]).join('')
    const scrambled = Buffer.alloc(SCRAMBLE_VALUES.length)
    SCRAMBLE_VALUES.forEach((value, index) => {
        scrambled[index] = value ^ parseInt(hashHex.slice(index * 2, index * 2 + 2), 16)
    })
    const middle = scrambled.toString('base64').replace(/[\\/+=]/g, '')
    return `zzc${part1}${middle}${part2}`.toLowerCase()
}

const fetchWithTimeout = async (input, init = {}) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
        return await fetch(input, { ...init, signal: controller.signal })
    } finally {
        clearTimeout(timer)
    }
}

const buildBeaconId = () => {
    const month = new Date().toISOString().slice(0, 7) + '-01'
    const first = crypto.randomInt(100000, 1000000)
    const second = crypto.randomInt(100000000, 1000000000)
    const datedIndexes = new Set([1, 2, 13, 14, 17, 18, 21, 22, 25, 26, 29, 30, 33, 34, 37, 38])
    let result = ''
    for (let index = 1; index <= 40; index += 1) {
        if (datedIndexes.has(index)) result += `k${index}:${month}${first}.${second}`
        else if (index === 3) result += 'k3:0000000000000000'
        else if (index === 4) result += `k4:${randomHex(16).replaceAll('0', '1')}`
        else result += `k${index}:${crypto.randomInt(0, 10000)}`
        result += ';'
    }
    return result
}

const getQimei = async () => {
    if (mobileDevice.qimei) return mobileDevice.qimei
    const payload = JSON.stringify({
        androidId: mobileDevice.androidId,
        platformId: 1,
        appKey: QIMEI_APP_KEY,
        appVersion: '14.9.0.8',
        beaconIdSrc: buildBeaconId(),
        brand: mobileDevice.brand,
        channelId: QIMEI_CHANNEL_ID,
        cid: '',
        imei: mobileDevice.imei,
        imsi: '',
        mac: '',
        model: mobileDevice.model,
        networkType: 'unknown',
        oaid: '',
        osVersion: `Android ${mobileDevice.release},level ${mobileDevice.sdk}`,
        qimei: '',
        qimei36: '',
        sdkVersion: '1.2.13.6',
        targetSdkVersion: '33',
        audit: '',
        userId: '{}',
        packageId: QIMEI_PACKAGE_ID,
        deviceType: 'Phone',
        sdkName: '',
        reserved: JSON.stringify({
            harmony: '0', clone: '0', containe: '',
            oz: 'UhYmelwouA+V2nPWbOvLTgN2/m8jwGB+yUB5v9tysQg=',
            oo: 'Xecjt+9S1+f8Pz2VLSxgpw==', kelong: '0',
            uptimes: new Date(Date.now() - crypto.randomInt(0, 14401) * 1000).toISOString().replace('T', ' ').slice(0, 19),
            multiUser: '0', bod: mobileDevice.brand, dv: mobileDevice.device,
            firstLevel: '', manufact: mobileDevice.brand, name: mobileDevice.model,
            host: 'se.infra', kernel: mobileDevice.procVersion,
        }),
    })
    const cryptKey = randomHex(16)
    const nonce = randomHex(16)
    const timestamp = Math.floor(Date.now() / 1000)
    const encryptedKey = crypto.publicEncrypt(
        { key: QIMEI_PUBLIC_KEY, padding: crypto.constants.RSA_PKCS1_PADDING },
        Buffer.from(cryptKey),
    ).toString('base64')
    const cipher = crypto.createCipheriv('aes-128-cbc', Buffer.from(cryptKey), Buffer.from(cryptKey))
    const encryptedPayload = Buffer.concat([cipher.update(payload), cipher.final()]).toString('base64')
    const extra = `{"appKey":"${QIMEI_APP_KEY}"}`
    const response = await fetchWithTimeout('https://api.tencentmusic.com/tme/trpc/proxy', {
        method: 'POST',
        headers: {
            method: 'GetQimei',
            service: 'trpc.tme_datasvr.qimeiproxy.QimeiProxy',
            appid: 'qimei_qq_android',
            sign: md5('qimei_qq_androidpzAuCmaFAaFaHrdakPjLIEqKrGnSOOvH', timestamp),
            timestamp: String(timestamp),
            'User-Agent': 'QQMusic',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            app: 0,
            os: 1,
            qimeiParams: {
                key: encryptedKey,
                params: encryptedPayload,
                time: String(timestamp),
                nonce,
                sign: md5(encryptedKey, encryptedPayload, timestamp * 1000, nonce, QIMEI_SECRET, extra),
                extra,
            },
        }),
    })
    if (!response.ok) throw new Error(`QQ 音乐设备认证失败 (${response.status})`)
    const result = await response.json()
    let data = {}
    try {
        data = JSON.parse(result?.data || '{}')?.data || {}
    } catch {
        data = {}
    }
    if (!data.q16 || !data.q36) throw new Error('QQ 音乐设备认证失败：未返回 QIMEI')
    mobileDevice.qimei = { q16: data.q16, q36: data.q36 }
    return mobileDevice.qimei
}

const buildAndroidComm = async (overrides = {}, persistedDevice = null) => {
    const qimei = persistedDevice
        ? { q16: persistedDevice.q16, q36: persistedDevice.q36 }
        : await getQimei()
    const guid = persistedDevice?.guid || mobileDevice.guid
    const androidId = persistedDevice?.androidId || mobileDevice.androidId
    const release = persistedDevice?.release || mobileDevice.release
    const sdk = persistedDevice?.sdk || mobileDevice.sdk
    const model = persistedDevice?.model || mobileDevice.model
    const fingerprint = persistedDevice?.fingerprint || mobileDevice.fingerprint
    return {
        ct: MOBILE_CT,
        cv: MOBILE_CV,
        v: MOBILE_CV,
        chid: QIMEI_CHANNEL_ID,
        tmeAppID: 'qqmusic',
        QIMEI: qimei.q16,
        QIMEI36: qimei.q36,
        OpenUDID: guid,
        udid: guid,
        OpenUDID2: guid,
        uid: mobileDevice.uid,
        sid: mobileDevice.sid,
        aid: androidId,
        os_ver: release,
        phonetype: model,
        devicelevel: sdk,
        newdevicelevel: sdk,
        rom: fingerprint,
        ...overrides,
    }
}

/**
 * 调用 music.login.LoginServer。
 * @param {{ method: string, param: object, comm?: object, allowErrorCodes?: boolean }} options
 * @returns {Promise<{ code: number, data: object, raw: object }>}
 */
export const postLoginServer = async ({ method, param, comm: commOverrides = {}, allowErrorCodes = false, deviceCookie = '' }) => {
    const persistedDevice = decodeLoginDevice(deviceCookie)
    const comm = await buildAndroidComm(commOverrides, persistedDevice)
    const body = JSON.stringify({
        comm,
        req_0: {
            module: 'music.login.LoginServer',
            method,
            param,
        },
    })
    const response = await fetchWithTimeout('https://u.y.qq.com/cgi-bin/musicu.fcg', {
        method: 'POST',
        body,
        headers: {
            'User-Agent': QQ_MUSIC_UA,
            'Content-Type': 'application/json',
        },
    })
    if (!response.ok) {
        throw new Error(`QQ 音乐登录接口请求失败 (${response.status})`)
    }
    const result = await response.json()
    const payload = result?.req_0
    const code = Number(payload?.code ?? result?.code ?? 0)
    const data = payload?.data || {}
    if (!allowErrorCodes && (result?.code !== 0 || payload?.code !== 0)) {
        const message = data?.errMsg || data?.errmsg || payload?.code || result?.code
        const error = new Error(`QQ 音乐登录失败: ${message || '未知错误'}${payload?.code ? `（错误码 ${payload.code}）` : ''}`)
        error.code = code
        error.data = data
        throw error
    }
    return { code, data, raw: result }
}

const postMusicApi = async (method, param, comm) => {
    const { data } = await postLoginServer({ method, param, comm, allowErrorCodes: false })
    return data
}

const formatLoginError = (code, data = {}) => {
    const messages = {
        1000: '登录鉴权参数无效或已过期，请重新扫码',
        104401: '登录鉴权参数无效或已过期，请重新扫码',
        104400: '登录鉴权参数无效或已过期，请重新扫码',
        20279: 'QQ 音乐登录设备数量超限，请在官方客户端移除旧设备后重试',
        20277: 'QQ 音乐账号受限，暂时无法登录',
        20278: 'QQ 音乐账号受限，暂时无法登录',
        20450: 'QQ 音乐账号已被封禁',
        104604: 'QQ 音乐登录操作过于频繁，请稍后重试',
    }
    return messages[code] || data?.errMsg || data?.errmsg || 'QQ 音乐登录失败'
}

const createQrBySignedApi = async () => {
    const method = 'CreateQRCode'
    const body = JSON.stringify({
        comm: {
            g_tk: 0,
            uin: 0,
            format: 'json',
            inCharset: 'utf-8',
            outCharset: 'utf-8',
            notice: 0,
            platform: 'h5',
            needNewCode: 1,
            ct: 23,
            cv: 0,
        },
        req_0: {
            module: 'music.login.LoginServer',
            method,
            param: {
                tmeAppID: 'qqmusic',
                ct: MOBILE_CT,
                cv: QR_CREATE_CV,
            },
        },
    })
    const response = await fetchWithTimeout(
        `https://u.y.qq.com/cgi-bin/musics.fcg?_webcgikey=${method}&sign=${encodeURIComponent(zzcSign(body))}&_=${Date.now()}`,
        {
            method: 'POST',
            body,
            headers: {
                'User-Agent': `QQMusic ${QR_CREATE_CV}(android 14)`,
                'Content-Type': 'application/json',
                Origin: 'https://y.qq.com',
                Referer: 'https://y.qq.com/',
            },
        },
    )
    if (!response.ok) throw new Error(`QQ 音乐二维码接口请求失败 (${response.status})`)
    const result = await response.json()
    const payload = result?.req_0
    if (result?.code !== 0 || payload?.code !== 0) {
        throw new Error(`QQ 音乐二维码生成失败${payload?.code ? `（错误码 ${payload.code}）` : ''}`)
    }
    return payload?.data || {}
}

const ensureMobileSession = async () => {
    if (mobileDevice.uid && mobileDevice.sid) return
    if (mobileDevice.sessionPromise) return mobileDevice.sessionPromise
    mobileDevice.sessionPromise = (async () => {
        const comm = await buildAndroidComm()
        const body = JSON.stringify({
            comm,
            req_0: {
                module: 'music.getSession.session',
                method: 'GetSession',
                param: { uid: '', vkey: 0, caller: 0 },
            },
        })
        const response = await fetchWithTimeout('https://u.y.qq.com/cgi-bin/musicu.fcg', {
            method: 'POST',
            body,
            headers: { 'User-Agent': QQ_MUSIC_UA, 'Content-Type': 'application/json' },
        })
        if (!response.ok) throw new Error(`QQ 音乐会话初始化失败 (${response.status})`)
        const result = await response.json()
        const session = result?.req_0?.data?.session
        if (result?.code !== 0 || result?.req_0?.code !== 0 || !session?.uid || !session?.sid) {
            throw new Error(`QQ 音乐会话初始化失败${result?.req_0?.code ? `（错误码 ${result.req_0.code}）` : ''}`)
        }
        mobileDevice.uid = String(session.uid)
        mobileDevice.sid = String(session.sid)
    })().finally(() => {
        mobileDevice.sessionPromise = null
    })
    return mobileDevice.sessionPromise
}

const callLoginApi = async (method, param, comm = {}) => {
    await ensureMobileSession()
    return postMusicApi(method, param, await buildAndroidComm(comm))
}

const cookieValue = (cookie, name) => {
    const value = cookie?.[name]
    return typeof value === 'string' ? value : value?.value || ''
}

const buildCookie = (data) => {
    const musicId = data.musicid || data.str_musicid || ''
    const musicKey = data.musickey || ''
    if (!musicId || !musicKey) {
        throw new Error('登录成功但未拿到 qqmusic_key')
    }
    const uin = String(musicId).startsWith('o') ? String(musicId) : `o${musicId}`
    const values = {
        login_type: String(data.loginType || 6),
        tmeLoginMethod: '3',
        tmeLoginType: String(data.loginType || 6),
        uin,
        wxuin: uin,
        euin: data.encryptUin || '',
        qqmusic_key: musicKey,
        qm_keyst: musicKey,
        p_lskey: musicKey,
        refresh_key: data.refresh_key || '',
        psrf_qqaccess_token: data.access_token || '',
        psrf_qqrefresh_token: data.refresh_token || '',
        psrf_qqopenid: data.openid || '',
        psrf_access_token_expiresAt: data.expired_at || '',
        psrf_musickey_createtime: data.musickeyCreateTime || '',
        // 续期必须复用本次扫码登录的设备指纹，否则 QQ 会把每次刷新视为新设备。
        [QQ_DEVICE_COOKIE_FIELD]: encodeLoginDevice(mobileDevice, mobileDevice.qimei),
    }
    return {
        uin,
        cookie: Object.entries(values)
            .filter(([, value]) => value !== undefined && value !== null && value !== '')
            .map(([key, value]) => `${key}=${value}`)
            .join('; '),
    }
}

/** qrcodeID -> { phase, result, client, expiresAt, inflight } */
const tencentQrSessions = new Map()

const shortQrId = (value) => {
    const raw = String(value || '')
    return raw ? `${raw.slice(0, 8)}...` : '-'
}

const closeSessionClient = (session) => {
    if (!session) return
    const client = session?.client
    session.client = null
    if (client) client.end(true)
}

const deleteSessionLater = (qrcodeId, delay = 60_000) => {
    setTimeout(() => {
        const session = tencentQrSessions.get(qrcodeId)
        closeSessionClient(session)
        tencentQrSessions.delete(qrcodeId)
    }, delay)
}

const confirmMobileLogin = async (qrcodeId, payload) => {
    const cookies = payload?.cookies || {}
    const musicId = cookieValue(cookies, 'qqmusic_uin')
    const token = cookieValue(cookies, 'qqmusic_key')
    const messageQrId = cookieValue(cookies, 'qrcode_id')
    if (!musicId || !token) {
        throw new Error('获取登录凭据失败：缺少 QQ 音乐账号信息')
    }
    if (messageQrId && messageQrId !== qrcodeId) {
        throw new Error('QQ 音乐二维码会话不匹配，请重新扫码')
    }
    const loginParams = {
        musicid: Number(String(musicId).replace(/\D/g, '')),
        qrCodeID: qrcodeId,
        token,
    }
    let data
    try {
        data = await callLoginApi('Login', loginParams, { tmeLoginType: 6 })
    } catch (error) {
        const code = Number(error?.code || 0)
        const mapped = new Error(`${formatLoginError(code, error?.data)}（错误码 ${code || '未知'}）`)
        mapped.code = code
        mapped.cause = error
        throw mapped
    }
    return buildCookie(data)
}

const buildMqttRedirectPath = (currentPath, serverReference) => {
    const path = String(currentPath || '/ws/handshake').replace(/\/+$/, '')
    const reference = String(serverReference || '').trim().replace(/^\/+|\/+$/g, '')
    if (!reference) return path
    const parts = path.split('/')
    if (parts.at(-1)?.includes(':')) {
        parts[parts.length - 1] = reference
        return parts.join('/')
    }
    return `${path}/${reference}`
}

const attachMobileStatus = (qrcodeId, session, mqttPath = '/ws/handshake') => {
    const clientId = `${Date.now()}${Math.floor(1000 + Math.random() * 9000)}`
    const connectProperties = {
        authenticationMethod: 'pass',
        userProperties: {
            tmeAppID: 'qqmusic',
            business: 'management',
            hashTag: qrcodeId,
            clientTag: 'management.user',
            userID: qrcodeId,
        },
    }
    const client = mqtt.connect(`wss://mu.y.qq.com${mqttPath}`, {
        protocolVersion: 5,
        clientId,
        clean: true,
        keepalive: 45,
        reconnectPeriod: 0,
        connectTimeout: 20_000,
        properties: connectProperties,
        wsOptions: {
            headers: {
                Origin: 'https://y.qq.com',
                Referer: 'https://y.qq.com/',
                'User-Agent': WEB_UA,
            },
        },
    })
    session.client = client

    client.on('packetreceive', (packet) => {
        if (packet?.cmd === 'connack') session.lastConnack = packet
    })

    client.on('connect', () => {
        client.subscribe(`management.qrcode_login/${qrcodeId}`, {
            qos: 0,
            properties: {
                userProperties: {
                    authorization: 'tmelogin',
                    pubsub: 'unicast',
                },
            },
        }, (error) => {
            if (error && session.phase === 'waiting') {
                session.phase = 'error'
                session.result = { status: 'error', message: 'QQ 音乐扫码状态订阅失败，请重试' }
            }
        })
    })

    client.on('message', (_topic, message, packet) => {
        let payload = {}
        try {
            payload = JSON.parse(message.toString('utf8'))
        } catch {
            payload = {}
        }
        const eventType = packet?.properties?.userProperties?.type || ''
        if (eventType === 'scanned') {
            session.phase = 'scanned'
            session.result = { status: 'scanned', message: '已扫码，请在 QQ 音乐 App 上确认' }
            return
        }
        if (eventType === 'canceled') {
            session.phase = 'error'
            session.result = { status: 'error', message: '已取消登录，请重新扫码' }
            closeSessionClient(session)
            return
        }
        if (eventType === 'timeout') {
            session.phase = 'expired'
            session.result = { status: 'expired', message: '二维码已过期，请刷新' }
            closeSessionClient(session)
            deleteSessionLater(qrcodeId)
            return
        }
        if (eventType === 'loginFailed') {
            session.phase = 'error'
            session.result = { status: 'error', message: payload?.errMsg || 'QQ 音乐登录失败，请重试' }
            closeSessionClient(session)
            return
        }
        if (eventType !== 'cookies' || session.inflight) return

        session.inflight = confirmMobileLogin(qrcodeId, payload)
            .then((credential) => {
                const confirmed = {
                    status: 'confirmed',
                    message: '登录成功',
                    cookie: credential.cookie,
                    uin: credential.uin,
                }
                session.phase = 'confirmed'
                session.result = confirmed
                closeSessionClient(session)
                deleteSessionLater(qrcodeId)
                return confirmed
            })
            .catch((error) => {
                session.phase = 'error'
                session.result = {
                    status: 'error',
                    message: error?.message || 'QQ 音乐登录失败，请重试',
                }
                closeSessionClient(session)
                return session.result
            })
            .finally(() => {
                session.inflight = null
            })
    })

    client.on('error', (error) => {
        if (session.phase === 'confirmed' || session.phase === 'expired') return
        const message = error?.message || ''
        if (/server moved/i.test(message) && session.mqttRetryCount < 3) {
            session.mqttRetryCount += 1
            const reference = session.lastConnack?.properties?.serverReference
            const nextPath = buildMqttRedirectPath(mqttPath, reference)
            session.lastConnack = null
            closeSessionClient(session)
            const delay = session.mqttRetryCount * 1000
            console.warn('[QQ QR] MQTT 节点迁移，准备重连', JSON.stringify({
                qrcodeId: shortQrId(qrcodeId),
                retry: session.mqttRetryCount,
                delayMs: delay,
                redirected: Boolean(reference),
                path: nextPath,
            }))
            setTimeout(() => {
                if (session.phase === 'waiting' || session.phase === 'scanned') {
                    attachMobileStatus(qrcodeId, session, nextPath)
                }
            }, delay)
            return
        }
        session.phase = 'error'
        session.result = {
            status: 'error',
            message: message || 'QQ 音乐扫码连接失败，请重试',
        }
        closeSessionClient(session)
    })
}

/** 创建 QQ 音乐 App 扫码会话 */
export const createTencentQrSession = async () => {
    const data = await createQrBySignedApi()
    const qrcodeId = String(data.qrcodeID || '')
    const qrimg = String(data.qrcode || '')
    if (!qrcodeId || !qrimg) {
        throw new Error('获取 QQ 音乐登录二维码失败')
    }

    const session = {
        phase: 'waiting',
        result: { status: 'waiting', message: '等待 QQ 音乐 App 扫码' },
        client: null,
        inflight: null,
        mqttRetryCount: 0,
        expiresAt: Date.now() + Math.max(Number(data.expiresIn) || 900, 60) * 1000,
    }
    const oldSession = tencentQrSessions.get(qrcodeId)
    closeSessionClient(oldSession)
    tencentQrSessions.set(qrcodeId, session)
    attachMobileStatus(qrcodeId, session)
    console.info('[QQ QR] 会话创建', JSON.stringify({
        pid: process.pid,
        qrcodeId: shortQrId(qrcodeId),
        expiresInMs: Math.max(0, session.expiresAt - Date.now()),
        sessionCount: tencentQrSessions.size,
    }))

    return {
        platform: 'tencent',
        key: qrcodeId,
        qrsig: qrcodeId,
        ptqrtoken: 'mobile',
        qrimg,
        message: '请使用 QQ 音乐 App 扫码',
    }
}

/** 读取 QQ 音乐 App 扫码状态 */
export const checkTencentQrSession = async ({ qrsig }) => {
    const qrcodeId = String(qrsig || '')
    if (!qrcodeId) {
        return { status: 'error', message: '缺少二维码会话标识' }
    }
    const session = tencentQrSessions.get(qrcodeId)
    if (!session) {
        console.warn('[QQ QR] 检查不到会话', JSON.stringify({
            pid: process.pid,
            qrcodeId: shortQrId(qrcodeId),
            sessionCount: tencentQrSessions.size,
        }))
        return { status: 'expired', message: '二维码会话不存在或已过期' }
    }
    console.info('[QQ QR] 检查会话', JSON.stringify({
        pid: process.pid,
        qrcodeId: shortQrId(qrcodeId),
        phase: session.phase,
        expiresInMs: Math.max(0, session.expiresAt - Date.now()),
    }))
    if (Date.now() >= Math.min(session.expiresAt, Date.now() + SESSION_EXPIRE_MS)) {
        session.phase = 'expired'
        session.result = { status: 'expired', message: '二维码已过期，请刷新' }
        closeSessionClient(session)
        deleteSessionLater(qrcodeId)
    }
    if (session.inflight) await session.inflight
    return { ...(session.result || { status: session.phase, message: '等待 QQ 音乐 App 扫码' }) }
}
