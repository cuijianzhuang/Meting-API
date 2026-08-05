import crypto from 'crypto'
import { Buffer } from 'buffer/index.js'
import { get_public_base } from '../../util.js'

const WEB_UA = 'LunaPC/3.3.0(359450208)'

const emptyBox = () => ({ size: 0, offset: 0, data: Buffer.alloc(0) })

const findBox = (buffer, wanted, start = 0, end = buffer.length) => {
    let offset = start
    while (offset + 8 <= end) {
        const size = buffer.readUInt32BE(offset)
        if (size < 8 || offset + size > end) break
        const type = buffer.subarray(offset + 4, offset + 8).toString('ascii')
        if (type === wanted) return { size, offset, data: buffer.subarray(offset + 8, offset + size) }
        offset += size
    }
    return emptyBox()
}

const bitCount = (input) => {
    let value = input
    value -= (value >> 1) & 0x55555555
    value = (value & 0x33333333) + ((value >> 2) & 0x33333333)
    return (((value + (value >> 4)) & 0x0f0f0f0f) * 0x01010101) >> 24
}

const decodeSpadeA = (value) => {
    const source = Buffer.from(String(value || ''), 'base64')
    if (source.length < 3) return ''
    const padding = (source[0] ^ source[1] ^ source[2]) - 48
    if (padding < 0 || source.length < padding + 2) return ''
    const input = source.subarray(1, source.length - padding)
    const working = Buffer.alloc(input.length + 2)
    working[0] = 0xfa
    working[1] = 0x55
    input.copy(working, 2)
    const decoded = Buffer.alloc(input.length)
    for (let index = 0; index < decoded.length; index += 1) {
        let byte = (input[index] ^ working[index]) - bitCount(index) - 21
        while (byte < 0) byte += 0xff
        decoded[index] = byte & 0xff
    }
    const first = decoded[0]
    const skip = first >= 48 && first <= 57 ? first - 48 : first >= 97 && first <= 122 ? first - 87 : 255
    const end = 1 + source.length - padding - 2 - skip
    return end > 1 && end <= decoded.length ? decoded.subarray(1, end).toString('utf8') : ''
}

const parseSampleSizes = (data) => {
    const size = data.readUInt32BE(4)
    const count = data.readUInt32BE(8)
    if (size) return Array.from({ length: count }, () => size)
    return Array.from({ length: count }, (_, index) => data.readUInt32BE(12 + index * 4))
}

const parseIvs = (data) => {
    const count = data.readUInt32BE(4)
    return Array.from({ length: count }, (_, index) => {
        const iv = Buffer.alloc(16)
        data.copy(iv, 0, 8 + index * 8, 16 + index * 8)
        return iv
    })
}

const flacMetadata = (stsd) => {
    const index = stsd.data.indexOf(Buffer.from('dfLa'))
    if (index < 4) return Buffer.alloc(0)
    const size = stsd.data.readUInt32BE(index - 4)
    const end = Math.min(index - 4 + size, stsd.data.length)
    return stsd.data.subarray(index + 8, end)
}

export const decryptQishuiAudio = (source, spadeA) => {
    const encrypted = Buffer.isBuffer(source) ? source : Buffer.from(source)
    const keyHex = /^[0-9a-f]+$/i.test(String(spadeA || '')) ? String(spadeA) : decodeSpadeA(spadeA)
    const key = Buffer.from(keyHex, 'hex')
    if (key.length !== 16) throw new Error('汽水音频密钥无效')

    const moov = findBox(encrypted, 'moov')
    const trak = findBox(encrypted, 'trak', moov.offset + 8, moov.offset + moov.size)
    const mdia = findBox(encrypted, 'mdia', trak.offset + 8, trak.offset + trak.size)
    const minf = findBox(encrypted, 'minf', mdia.offset + 8, mdia.offset + mdia.size)
    const stbl = findBox(encrypted, 'stbl', minf.offset + 8, minf.offset + minf.size)
    const stsd = findBox(encrypted, 'stsd', stbl.offset + 8, stbl.offset + stbl.size)
    const stsz = findBox(encrypted, 'stsz', stbl.offset + 8, stbl.offset + stbl.size)
    let senc = findBox(encrypted, 'senc', moov.offset + 8, moov.offset + moov.size)
    if (!senc.size) senc = findBox(encrypted, 'senc', stbl.offset + 8, stbl.offset + stbl.size)
    const mdat = findBox(encrypted, 'mdat')
    if (![moov, trak, mdia, minf, stbl, stsd, stsz, senc, mdat].every(box => box.size)) {
        throw new Error('汽水音频容器缺少必要 MP4 box')
    }

    const sizes = parseSampleSizes(stsz.data)
    const ivs = parseIvs(senc.data)
    if (sizes.length !== ivs.length) throw new Error('汽水音频样本与 IV 数量不一致')
    const samples = []
    let offset = mdat.offset + 8
    for (let index = 0; index < sizes.length; index += 1) {
        const decipher = crypto.createDecipheriv('aes-128-ctr', key, ivs[index])
        samples.push(Buffer.concat([decipher.update(encrypted.subarray(offset, offset + sizes[index])), decipher.final()]))
        offset += sizes[index]
    }

    const metadata = flacMetadata(stsd)
    if (metadata.length) {
        return { buffer: Buffer.concat([Buffer.from('fLaC'), metadata, ...samples]), contentType: 'audio/flac' }
    }
    const output = Buffer.from(encrypted)
    let writeAt = mdat.offset + 8
    samples.forEach(sample => { sample.copy(output, writeAt); writeAt += sample.length })
    const marker = output.indexOf(Buffer.from('enca'), stsd.offset)
    if (marker >= stsd.offset && marker < stsd.offset + stsd.size) Buffer.from('mp4a').copy(output, marker)
    return { buffer: output, contentType: 'audio/mp4' }
}

const cache = new Map()
const inflightLoads = new Map()
const MAX_CACHE_BYTES = 512 * 1024 * 1024
let cacheBytes = 0

const diskCacheDir = (() => {
    const runtime = globalThis?.process?.release?.name === 'node' || globalThis?.Bun !== undefined
    if (!runtime) return ''
    const base = String(globalThis?.process?.env?.DATA_DIR || './data').trim() || './data'
    return `${base.replace(/\\/g, '/').replace(/\/+$/, '')}/qishui-audio-cache`
})()

let diskFs = null
let diskPath = null

const getDiskModules = async () => {
    if (!diskCacheDir) return null
    if (diskFs && diskPath) return { fs: diskFs, path: diskPath }
    diskFs = await import('node:fs/promises')
    diskPath = await import('node:path')
    await diskFs.mkdir(diskCacheDir, { recursive: true })
    return { fs: diskFs, path: diskPath }
}

const diskPaths = (key) => ({
    body: `${diskCacheDir}/${key}.bin`,
    meta: `${diskCacheDir}/${key}.json`,
})

const readDiskCache = async (key) => {
    const mods = await getDiskModules()
    if (!mods) return null
    const { fs } = mods
    const paths = diskPaths(key)
    try {
        const metaRaw = await fs.readFile(paths.meta, 'utf8')
        const meta = JSON.parse(metaRaw)
        const buffer = await fs.readFile(paths.body)
        if (!buffer?.length || !meta?.contentType) return null
        return { buffer, contentType: meta.contentType, at: meta.at || Date.now() }
    } catch {
        return null
    }
}

const writeDiskCache = async (key, value) => {
    const mods = await getDiskModules()
    if (!mods) return
    const { fs } = mods
    const paths = diskPaths(key)
    const tmpBody = `${paths.body}.${process.pid}.tmp`
    const tmpMeta = `${paths.meta}.${process.pid}.tmp`
    try {
        await fs.writeFile(tmpBody, value.buffer)
        await fs.writeFile(tmpMeta, JSON.stringify({
            contentType: value.contentType,
            at: Date.now(),
            bytes: value.buffer.length,
        }))
        await fs.rename(tmpBody, paths.body)
        await fs.rename(tmpMeta, paths.meta)
    } catch (error) {
        await fs.unlink(tmpBody).catch(() => {})
        await fs.unlink(tmpMeta).catch(() => {})
        console.warn('[QishuiAudio] 磁盘缓存写入失败:', error?.message || error)
    }
}

const remember = (key, value, { persistDisk = true } = {}) => {
    const existing = cache.get(key)
    if (existing) cacheBytes -= existing.buffer.length
    cache.set(key, { ...value, at: Date.now() })
    cacheBytes += value.buffer.length
    while (cacheBytes > MAX_CACHE_BYTES && cache.size > 1) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        cache.delete(oldest[0])
        cacheBytes -= oldest[1].buffer.length
    }
    if (persistDisk) void writeDiskCache(key, value)
}

const cacheKey = (url, auth) => crypto.createHash('sha1').update(`${url}\n${auth}`).digest('hex')
const etagForKey = (key) => `"${key}"`

const PLAY_TOKEN_TTL = 30 * 60 * 1000
const playTokens = new Map()

const prunePlayTokens = () => {
    const now = Date.now()
    for (const [token, entry] of playTokens) {
        if (now > entry.expiresAt) playTokens.delete(token)
    }
    if (playTokens.size <= 1000) return
    const oldest = [...playTokens.entries()].sort((a, b) => a[1].expiresAt - b[1].expiresAt)
    for (let index = 0; index < oldest.length - 1000; index += 1) {
        playTokens.delete(oldest[index][0])
    }
}

export const createQishuiPlayToken = (url, auth, mimeType) => {
    const token = crypto.randomBytes(16).toString('hex')
    playTokens.set(token, {
        url,
        auth,
        mimeType: mimeType || '',
        expiresAt: Date.now() + PLAY_TOKEN_TTL,
    })
    prunePlayTokens()
    preloadQishuiAudio(url, auth)
    return token
}

export const resolveQishuiPlayToken = (token) => {
    const entry = playTokens.get(String(token || ''))
    if (!entry) return null
    if (Date.now() > entry.expiresAt) {
        playTokens.delete(String(token))
        return null
    }
    return entry
}

export const isQishuiRequestAbort = (error, signal) => {
    if (signal?.aborted) return true
    return error?.name === 'AbortError' || error?.code === 'ABORT_ERR'
        || /^(?:terminated|aborted)$/i.test(String(error?.message || '').trim())
        || /(?:client|request|socket).*(?:closed|abort|reset)|aborted/i.test(String(error?.message || ''))
}

const fetchQishuiSource = async (url, signal) => {
    try {
        return await fetch(url, {
            signal,
            headers: { 'User-Agent': WEB_UA, Referer: 'https://www.qishui.com/' },
        })
    } catch (error) {
        if (signal?.aborted || error?.name === 'AbortError') throw error
        if (!/terminated|socket|reset|network/i.test(String(error?.message || ''))) throw error
        return fetch(url, {
            signal,
            headers: { 'User-Agent': WEB_UA, Referer: 'https://www.qishui.com/' },
        })
    }
}

export const preloadQishuiAudio = (url, auth) => {
    void loadQishuiAudio(url, auth).catch(error => {
        if (!isQishuiRequestAbort(error)) {
            console.warn('[QishuiAudio] 预热失败:', error?.message || error)
        }
    })
}

export const loadQishuiAudio = async (url, auth) => {
    const key = cacheKey(url, auth)
    const cached = cache.get(key)
    if (cached) {
        cached.at = Date.now()
        return { ...cached, cacheHit: true, cacheSource: 'memory' }
    }

    const diskCached = await readDiskCache(key)
    if (diskCached) {
        remember(key, diskCached, { persistDisk: false })
        return { ...diskCached, cacheHit: true, cacheSource: 'disk' }
    }

    if (inflightLoads.has(key)) {
        const shared = await inflightLoads.get(key)
        return { ...shared, cacheHit: shared.cacheHit ?? false, cacheSource: shared.cacheSource || 'shared' }
    }

    // 与客户端 Range/切歌断开解耦：后台拉完并缓存，避免低带宽服务器重复从 CDN 下载。
    const task = (async () => {
        const response = await fetchQishuiSource(url)
        if (!response.ok) throw new Error(`汽水音频下载失败: ${response.status}`)
        const raw = Buffer.from(await response.arrayBuffer())
        const result = auth ? decryptQishuiAudio(raw, auth) : {
            buffer: raw,
            contentType: response.headers.get('content-type') || 'audio/mp4',
        }
        remember(key, result)
        return { ...result, cacheHit: false, cacheSource: 'cdn' }
    })()

    inflightLoads.set(key, task)
    try {
        return await task
    } finally {
        inflightLoads.delete(key)
    }
}

/** 浏览器可直链播放的汽水解密地址（公开；每次下发 30 分钟有效的 t） */
export const buildQishuiAudioUrl = (ctx, { url, auth, mimeType }) => {
    const token = createQishuiPlayToken(url, auth, mimeType)
    const endpoint = new URL(`${get_public_base(ctx)}/audio/qishui`)
    endpoint.searchParams.set('t', token)
    if (mimeType) endpoint.searchParams.set('mime_type', mimeType)
    return endpoint.toString()
}

export const wrapQishuiPlayPayload = (ctx, payload) => {
    if (!payload?.url || !payload?.auth) return payload
    const wrapped = { ...payload, url: buildQishuiAudioUrl(ctx, payload) }
    delete wrapped.auth
    return wrapped
}

const CHUNK_SIZE = 512 * 1024

const bodyForRange = (buffer, start, end) => {
    const slice = buffer.subarray(start, end + 1)
    if (slice.length <= CHUNK_SIZE) return slice
    return new ReadableStream({
        start(controller) {
            let offset = 0
            while (offset < slice.length) {
                const next = slice.subarray(offset, offset + CHUNK_SIZE)
                offset += next.length
                controller.enqueue(next)
            }
            controller.close()
        },
    })
}

export const qishuiAudioResponse = async (ctx) => {
    const token = String(ctx.req.query('t') || '').trim()
    if (!token) return ctx.json({ error: 'missing qishui play token' }, 400)

    const entry = resolveQishuiPlayToken(token)
    if (!entry) return ctx.json({ error: 'qishui play token expired' }, 403)

    const url = entry.url
    const auth = entry.auth
    if (!/^https?:\/\//i.test(url)) return ctx.json({ error: 'invalid qishui audio url' }, 400)

    const signal = ctx.req.raw?.signal
    const contentKey = cacheKey(url, auth)
    const etag = etagForKey(contentKey)
    if (ctx.req.header('if-none-match') === etag) {
        return new Response(null, {
            status: 304,
            headers: {
                ETag: etag,
                'Cache-Control': `private, max-age=${Math.floor(PLAY_TOKEN_TTL / 1000)}`,
            },
        })
    }
    const audio = await loadQishuiAudio(url, auth)
    if (signal?.aborted) throw Object.assign(new Error('汽水音频请求已取消'), { name: 'AbortError' })
    const total = audio.buffer.length
    const match = /^bytes=(\d*)-(\d*)$/i.exec(ctx.req.header('range') || '')
    let start = 0
    let end = total - 1
    let status = 200
    if (match) {
        start = match[1] ? Number(match[1]) : 0
        end = match[2] ? Number(match[2]) : total - 1
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= total) {
            return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${total}` } })
        }
        end = Math.min(end, total - 1)
        status = 206
    }
    const headers = {
        'Content-Type': audio.contentType,
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': `private, max-age=${Math.floor(PLAY_TOKEN_TTL / 1000)}`,
        ETag: etag,
        'X-Accel-Buffering': 'no',
        'X-Qishui-Cache': audio.cacheHit ? (audio.cacheSource || 'hit') : 'miss',
    }
    if (status === 206) {
        headers['Content-Range'] = `bytes ${start}-${end}/${total}`
        headers['Content-Length'] = String(end - start + 1)
    } else {
        headers['Content-Length'] = String(total)
    }
    return new Response(bodyForRange(audio.buffer, start, end), { status, headers })
}
