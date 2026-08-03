import crypto from 'crypto'
import { Buffer } from 'buffer/index.js'

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
    return stsd.data.subarray(index + 4, Math.min(index - 4 + size, stsd.data.length))
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
const MAX_CACHE_BYTES = 256 * 1024 * 1024
let cacheBytes = 0

const remember = (key, value) => {
    cache.set(key, { ...value, at: Date.now() })
    cacheBytes += value.buffer.length
    while (cacheBytes > MAX_CACHE_BYTES && cache.size > 1) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        cache.delete(oldest[0])
        cacheBytes -= oldest[1].buffer.length
    }
}

export const loadQishuiAudio = async (url, auth) => {
    const key = crypto.createHash('sha1').update(`${url}\n${auth}`).digest('hex')
    const cached = cache.get(key)
    if (cached) { cached.at = Date.now(); return cached }
    const response = await fetch(url, { headers: { 'User-Agent': WEB_UA, Referer: 'https://www.qishui.com/' } })
    if (!response.ok) throw new Error(`汽水音频下载失败: ${response.status}`)
    const raw = Buffer.from(await response.arrayBuffer())
    const result = auth ? decryptQishuiAudio(raw, auth) : {
        buffer: raw,
        contentType: response.headers.get('content-type') || 'audio/mp4',
    }
    remember(key, result)
    return result
}

export const qishuiAudioResponse = async (ctx) => {
    const url = ctx.req.query('url') || ''
    const auth = ctx.req.query('auth') || ''
    if (!/^https?:\/\//i.test(url)) return ctx.json({ error: 'invalid qishui audio url' }, 400)
    const audio = await loadQishuiAudio(url, auth)
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
        'Content-Length': String(end - start + 1),
        'Cache-Control': 'private, max-age=180',
    }
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${end}/${total}`
    return new Response(audio.buffer.subarray(start, end + 1), { status, headers })
}


