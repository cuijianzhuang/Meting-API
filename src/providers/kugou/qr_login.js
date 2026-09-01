import { createHash, randomUUID } from 'node:crypto'

const LOGIN_BASE = 'https://login-user.kugou.com'
const WEB_SIGN_SALT = 'NVPh5oo715z5DIWAeQlhMDsWXXQV4hwt'
const APP_ID = 3116
const CLIENT_VER = 11440
const SRC_APP_ID = 2919
const QR_TTL_MS = 5 * 60 * 1000
const sessions = new Map()

const text = (value) => String(value ?? '').trim()
const md5 = (value) => createHash('md5').update(String(value)).digest('hex')

const webSignature = (params) => md5(`${WEB_SIGN_SALT}${Object.keys(params)
  .map((key) => `${key}=${params[key]}`)
  .sort()
  .join('')}${WEB_SIGN_SALT}`)

const buildParams = (params = {}) => {
  const clienttime = Math.floor(Date.now() / 1000)
  const values = {
    appid: APP_ID,
    clientver: CLIENT_VER,
    clienttime,
    dfid: '-',
    mid: '0',
    uuid: '-',
    ...params,
  }
  values.signature = webSignature(values)
  return values
}

const cookieValue = (key, value) => `${key}=${value}`

const randomDeviceCode = () => randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase()
const createDeviceIdentity = () => {
  const guid = md5(randomUUID())
  return {
    guid,
    mid: BigInt(`0x${md5(guid)}`).toString(10),
    dev: randomDeviceCode(),
  }
}

export const buildKugouQrCookie = (identity) => {
  const device = identity && typeof identity === 'object' ? identity : createDeviceIdentity()
  return [
    cookieValue('KUGOU_API_GUID', device.guid),
    cookieValue('KUGOU_API_MID', device.mid),
    cookieValue('KUGOU_API_DEV', device.dev),
    cookieValue('KUGOU_API_MAC', '02:00:00:00:00:00'),
    'dfid=-',
  ].join('; ')
}

const requestKugouQr = async (path, params, cookie = '') => {
  const url = new URL(path, LOGIN_BASE)
  Object.entries(buildParams(params)).forEach(([key, value]) => url.searchParams.set(key, String(value)))
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36',
      Referer: 'https://h5.kugou.com/',
      Origin: 'https://h5.kugou.com',
      ...(cookie ? { Cookie: cookie } : {}),
    },
  })
  if (!response.ok) throw new Error(`酷狗扫码接口返回 ${response.status}`)
  return response.json()
}

const createRequest = (device) => requestKugouQr('/v2/qrcode', {
  appid: 1001,
  type: 1,
  plat: 4,
  qrcode_txt: `https://h5.kugou.com/apps/loginQRCode/html/index.html?appid=${APP_ID}&`,
  srcappid: SRC_APP_ID,
}, buildKugouQrCookie(device))

const checkRequest = (key, device) => requestKugouQr('/v2/get_userinfo_qrcode', {
  plat: 4,
  appid: APP_ID,
  srcappid: SRC_APP_ID,
  qrcode: key,
  dev: device.dev,
}, buildKugouQrCookie(device))

export const getKugouQrSession = (key) => sessions.get(text(key)) || null

export const createKugouQrSession = async ({ request = createRequest } = {}) => {
  const device = createDeviceIdentity()
  const response = await request(device)
  const key = text(response?.data?.qrcode || response?.data?.key || response?.qrcode || response?.key)
  if (!key || Number(response?.status) === 0) {
    throw new Error(response?.error || response?.msg || '获取酷狗登录二维码失败')
  }

  const session = {
    key,
    device,
    cookie: buildKugouQrCookie(device),
    expiresAt: Date.now() + QR_TTL_MS,
    phase: 'waiting',
    result: { status: 'waiting', message: '等待酷狗音乐 App 扫码' },
    inflight: null,
  }
  sessions.set(key, session)
  return {
    platform: 'kugou',
    key,
    qrurl: `https://h5.kugou.com/apps/loginQRCode/html/index.html?qrcode=${encodeURIComponent(key)}`,
    message: '请使用酷狗音乐 App 扫码',
  }
}

const credentialCookie = (data, session) => {
  const token = text(data?.token)
  const userid = text(data?.userid || data?.user_id)
  if (!token || !userid) return ''
  const values = {
    token,
    userid,
    vip_token: text(data?.vip_token),
    vip_type: text(data?.vip_type),
    dfid: '-',
    KUGOU_API_GUID: session.device.guid,
    KUGOU_API_DEV: session.device.dev,
    KUGOU_API_MID: session.device.mid,
  }
  return Object.entries(values).filter(([, value]) => value).map(([key, value]) => cookieValue(key, value)).join('; ')
}

export const checkKugouQrSession = async (key, { request = checkRequest } = {}) => {
  const session = getKugouQrSession(key)
  if (!session) return { status: 'expired', message: '二维码会话不存在或已过期' }
  if (session.result?.status === 'confirmed' || session.result?.status === 'expired') return { ...session.result }
  if (Date.now() >= session.expiresAt) {
    session.phase = 'expired'
    session.result = { status: 'expired', message: '二维码已过期，请刷新' }
    sessions.delete(session.key)
    return { ...session.result }
  }
  if (session.inflight) return session.inflight

  session.inflight = (async () => {
    try {
      const response = await request(session.key, session.device)
      const data = response?.data || {}
      const status = Number(data?.status ?? response?.status)
      if (status === 4) {
        const cookie = credentialCookie(data, session)
        if (!cookie) return { status: 'error', message: '酷狗登录成功但未返回 token 或 userid，请重新扫码' }
        session.phase = 'confirmed'
        session.result = { status: 'confirmed', message: '登录成功', cookie, userId: text(data.userid || data.user_id), validation: { valid: true, source: 'qr' } }
        setTimeout(() => sessions.delete(session.key), 60_000)
        return { ...session.result }
      }
      if (status === 2) {
        session.phase = 'scanned'
        session.result = { status: 'scanned', message: '已扫码，请在酷狗音乐 App 上确认' }
      } else if (status === 0 || status === 3) {
        session.phase = 'expired'
        session.result = { status: 'expired', message: '二维码已过期，请刷新' }
        setTimeout(() => sessions.delete(session.key), 60_000)
      } else {
        session.phase = 'waiting'
        session.result = { status: 'waiting', message: '等待酷狗音乐 App 扫码' }
      }
      return { ...session.result }
    } catch (error) {
      return { status: 'error', message: error?.message || '查询酷狗扫码状态失败' }
    } finally {
      session.inflight = null
    }
  })()

  return session.inflight
}
