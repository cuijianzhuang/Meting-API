const round4 = (value) => Math.round(value * 10000) / 10000

const pcmLoudness = (channels) => {
    if (!Array.isArray(channels) || !channels.length) return undefined
    let sumSquares = 0
    let count = 0
    let peak = 0
    for (const channel of channels) {
        if (!channel || typeof channel.length !== 'number') continue
        for (let index = 0; index < channel.length; index += 1) {
            const sample = Number(channel[index])
            if (!Number.isFinite(sample)) continue
            const absolute = Math.abs(sample)
            if (absolute > peak) peak = absolute
            sumSquares += sample * sample
            count += 1
        }
    }
    if (!count) return undefined
    const rms = Math.sqrt(sumSquares / count)
    if (!(rms > 0) || !Number.isFinite(rms)) return { gain: -120, peak: round4(peak) }
    return {
        gain: round4(20 * Math.log10(rms)),
        peak: round4(peak),
    }
}

export const analyzePcmLoudness = (channels) => pcmLoudness(channels)

const decodeWav = (buffer) => {
    if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
        return undefined
    }
    let offset = 12
    let format
    let data
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4)
        const size = buffer.readUInt32LE(offset + 4)
        const end = Math.min(buffer.length, offset + 8 + size)
        if (id === 'fmt ' && end - offset >= 24) {
            format = {
                audioFormat: buffer.readUInt16LE(offset + 8),
                channels: buffer.readUInt16LE(offset + 10),
                bits: buffer.readUInt16LE(offset + 22),
            }
        } else if (id === 'data') {
            data = buffer.subarray(offset + 8, end)
        }
        offset += 8 + size + (size & 1)
    }
    if (!format || !data || format.audioFormat !== 1 || !format.channels || ![8, 16, 24, 32].includes(format.bits)) {
        return undefined
    }
    const bytesPerSample = format.bits / 8
    const frameBytes = bytesPerSample * format.channels
    const frameCount = Math.floor(data.length / frameBytes)
    const channels = Array.from({ length: format.channels }, () => new Float32Array(frameCount))
    for (let frame = 0; frame < frameCount; frame += 1) {
        for (let channel = 0; channel < format.channels; channel += 1) {
            const position = frame * frameBytes + channel * bytesPerSample
            let sample
            if (format.bits === 8) sample = (data[position] - 128) / 128
            else if (format.bits === 16) sample = data.readInt16LE(position) / 32768
            else if (format.bits === 24) {
                sample = (data[position] | (data[position + 1] << 8) | (data[position + 2] << 16))
                if (sample & 0x800000) sample |= 0xff000000
                sample /= 8388608
            } else sample = data.readInt32LE(position) / 2147483648
            channels[channel][frame] = sample
        }
    }
    return channels
}


const childBox = (buffer, parent, wanted) => {
    let offset = parent.offset + 8
    const end = parent.offset + parent.size
    while (offset + 8 <= end) {
        const size = buffer.readUInt32BE(offset)
        if (size < 8 || offset + size > end) return undefined
        if (buffer.toString('ascii', offset + 4, offset + 8) === wanted) {
            return { offset, size, data: buffer.subarray(offset + 8, offset + size) }
        }
        offset += size
    }
    return undefined
}

const readMp4Boxes = (buffer, wanted) => {
    const boxes = []
    let offset = 0
    while (offset + 8 <= buffer.length) {
        let size = buffer.readUInt32BE(offset)
        const type = buffer.toString('ascii', offset + 4, offset + 8)
        let headerSize = 8
        if (size === 1) {
            if (offset + 16 > buffer.length) break
            const large = Number(buffer.readBigUInt64BE(offset + 8))
            if (!Number.isSafeInteger(large)) break
            size = large
            headerSize = 16
        } else if (size === 0) size = buffer.length - offset
        if (size < headerSize || offset + size > buffer.length) break
        if (type === wanted) boxes.push({ offset, size, data: buffer.subarray(offset + headerSize, offset + size) })
        offset += size
    }
    return boxes
}

const readDescriptorLength = (buffer, offset) => {
    let length = 0
    for (let index = 0; index < 4 && offset + index < buffer.length; index += 1) {
        const byte = buffer[offset + index]
        length = (length << 7) | (byte & 0x7f)
        if (!(byte & 0x80)) return { length, bytes: index + 1 }
    }
    return undefined
}

const findAudioSpecificConfig = (buffer, sampleEntry) => {
    let esds
    let offset = sampleEntry.offset + 8 + 28
    const end = sampleEntry.offset + sampleEntry.size
    while (offset + 8 <= end) {
        const size = buffer.readUInt32BE(offset)
        if (size < 8 || offset + size > end) return undefined
        if (buffer.toString('ascii', offset + 4, offset + 8) === 'esds') {
            esds = { offset, size, data: buffer.subarray(offset + 8, offset + size) }
            break
        }
        offset += size
    }
    if (!esds) return undefined
    const data = esds.data.subarray(4)
    for (let index = 0; index + 2 < data.length; index += 1) {
        if (data[index] !== 0x05) continue
        const descriptor = readDescriptorLength(data, index + 1)
        if (!descriptor || index + 1 + descriptor.bytes + descriptor.length > data.length) continue
        const start = index + 1 + descriptor.bytes
        if (descriptor.length >= 2) return data.subarray(start, start + descriptor.length)
    }
    return undefined
}

const parseMp4AudioTrack = (buffer) => {
    const moov = readMp4Boxes(buffer, 'moov')[0]
    const mdat = readMp4Boxes(buffer, 'mdat')[0]
    if (!moov || !mdat) return undefined
    let trak
    let offset = moov.offset + 8
    const moovEnd = moov.offset + moov.size
    while (offset + 8 <= moovEnd) {
        const size = buffer.readUInt32BE(offset)
        if (size < 8 || offset + size > moovEnd) break
        const candidate = { offset, size }
        if (buffer.toString('ascii', offset + 4, offset + 8) === 'trak') {
            const mdia = childBox(buffer, candidate, 'mdia')
            const hdlr = mdia && childBox(buffer, mdia, 'hdlr')
            if (hdlr && hdlr.data.toString('ascii', 8, 12) === 'soun') {
                trak = candidate
                break
            }
        }
        offset += size
    }
    if (!trak) return undefined
    const mdia = childBox(buffer, trak, 'mdia')
    const minf = mdia && childBox(buffer, mdia, 'minf')
    const stbl = minf && childBox(buffer, minf, 'stbl')
    const stsd = stbl && childBox(buffer, stbl, 'stsd')
    const stsz = stbl && childBox(buffer, stbl, 'stsz')
    const stsc = stbl && childBox(buffer, stbl, 'stsc')
    const stco = (stbl && childBox(buffer, stbl, 'stco')) || (stbl && childBox(buffer, stbl, 'co64'))
    if (!stsd || !stsz || !stsc || !stco) return undefined
    const sampleEntryOffset = stsd.offset + 16
    if (sampleEntryOffset + 8 > stsd.offset + stsd.size) return undefined
    const sampleEntry = {
        offset: sampleEntryOffset,
        size: buffer.readUInt32BE(sampleEntryOffset),
    }
    const asc = findAudioSpecificConfig(buffer, sampleEntry)
    if (!asc?.length) return undefined

    const sampleSize = stsz.data.readUInt32BE(4)
    const sampleCount = stsz.data.readUInt32BE(8)
    const sizes = sampleSize ? Array.from({ length: sampleCount }, () => sampleSize)
        : Array.from({ length: sampleCount }, (_, index) => stsz.data.readUInt32BE(12 + index * 4))
    const chunkCount = stco.data.readUInt32BE(4)
    const chunkOffsets = Array.from({ length: chunkCount }, (_, index) => stco.data[0] === undefined
        ? 0
        : stco.size && buffer.toString('ascii', stco.offset + 4, stco.offset + 8) === 'co64'
            ? Number(stco.data.readBigUInt64BE(8 + index * 8))
            : stco.data.readUInt32BE(8 + index * 4))
    const stscCount = stsc.data.readUInt32BE(4)
    const mappings = Array.from({ length: stscCount }, (_, index) => ({
        firstChunk: stsc.data.readUInt32BE(8 + index * 12),
        samplesPerChunk: stsc.data.readUInt32BE(12 + index * 12),
    }))
    const samples = []
    let sampleIndex = 0
    for (let chunk = 1; chunk <= chunkCount && sampleIndex < sizes.length; chunk += 1) {
        let mapping = mappings[0]
        for (let index = 0; index < mappings.length; index += 1) {
            if (mappings[index].firstChunk <= chunk) mapping = mappings[index]
            else break
        }
        if (!mapping?.samplesPerChunk) return undefined
        let position = chunkOffsets[chunk - 1]
        for (let index = 0; index < mapping.samplesPerChunk && sampleIndex < sizes.length; index += 1) {
            const size = sizes[sampleIndex]
            if (!Number.isSafeInteger(position) || position < mdat.offset || position + size > buffer.length) return undefined
            samples.push(buffer.subarray(position, position + size))
            position += size
            sampleIndex += 1
        }
    }
    return sampleIndex === sizes.length ? { asc, samples } : undefined
}

const decodeAacMp4 = async (buffer) => {
    const track = parseMp4AudioTrack(buffer)
    if (!track) return undefined
    const { AACDecoder } = await import('@wasm-audio-decoders/aac')
    const decoder = new AACDecoder({ audioSpecificConfig: new Uint8Array(track.asc) })
    try {
        await decoder.ready
        const decoded = await decoder.decodeFrames(track.samples.map(sample => new Uint8Array(sample)))
        if (decoded?.errors?.length) throw new Error(`AAC 解码失败: ${decoded.errors[0].message || '未知错误'}`)
        return decoded?.channelData
    } finally {
        decoder.free()
    }
}
const isFlac = (buffer) => buffer.length >= 4 && buffer.toString('ascii', 0, 4) === 'fLaC'

const decodeFlac = async (buffer) => {
    const { FLACDecoder } = await import('@wasm-audio-decoders/flac')
    const decoder = new FLACDecoder()
    try {
        await decoder.ready
        const decoded = await decoder.decodeFile(new Uint8Array(buffer))
        if (decoded?.errors?.length) {
            throw new Error(`FLAC 解码失败: ${decoded.errors[0].message || '未知错误'}`)
        }
        return decoded?.channelData
    } finally {
        decoder.free()
    }
}

/**
 * 在没有平台响度字段时，从已解密的音频计算兼容的 gain/peak。
 * gain 使用全音频 PCM 的 RMS dBFS，peak 使用线性峰值；不调用 ffmpeg。
 */
export const analyzeQishuiAudioBuffer = async (source, contentType = '') => {
    const buffer = Buffer.isBuffer(source) ? source : Buffer.from(source || [])
    if (!buffer.length) return undefined
    try {
        const channels = decodeWav(buffer)
        if (channels) return pcmLoudness(channels)
        if (isFlac(buffer) || /flac/i.test(String(contentType))) {
            return pcmLoudness(await decodeFlac(buffer))
        }
        if (/mp4|m4a|aac/i.test(String(contentType)) || buffer.toString('ascii', 4, 8) === 'ftyp') {
            return pcmLoudness(await decodeAacMp4(buffer))
        }
    } catch (error) {
        console.warn('[QishuiAudio] 响度分析失败:', error?.message || error)
    }
    return undefined
}




