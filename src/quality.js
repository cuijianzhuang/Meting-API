export const VALID_QUALITY = {
    tencent: [
        '128', 'standard', '320', 'exhigh', 'flac', 'lossless',
        'atmos', 'master',
    ],
    netease: [
        '128', 'standard', 'higher', '320', 'exhigh', 'flac', 'lossless', 'hires',
        'jyeffect', 'sky', 'jymaster', 'dolby',
    ],
}

/**
 * 音质中文名与会员要求
 * 网易：高清臻音及以下多为 VIP；以上（sky / jymaster / dolby）需 SVIP
 * QQ：对齐官方 — 标准品质 / HQ高品质 / SQ无损品质 / 臻品全景声 / 臻品母带
 *     （dtsX 为音效、NAC 为省流编解码，本 API 暂不提供）
 */
export const QUALITY_META = {
    '128': { name: '标准', tencent: '标准品质', vip: false, svip: false },
    'standard': { name: '标准', tencent: '标准品质', vip: false, svip: false },
    'higher': { name: '较高', vip: false, svip: false },
    '320': { name: '极高', tencent: 'HQ高品质', vip: true, svip: false },
    'exhigh': { name: '极高', tencent: 'HQ高品质', vip: true, svip: false },
    'flac': { name: '无损', tencent: 'SQ无损品质', vip: true, svip: false },
    'lossless': { name: '无损', tencent: 'SQ无损品质', vip: true, svip: false },
    // 网易云
    'hires': { name: '高解析度无损', vip: true, svip: false },
    'jyeffect': { name: '高清臻音', vip: true, svip: false },
    'sky': { name: '沉浸环绕声', vip: false, svip: true },
    'jymaster': { name: '超清母带', vip: false, svip: true },
    'dolby': { name: '杜比全景声', vip: false, svip: true },
    // QQ 音乐（超级会员独家）
    'atmos': { name: '臻品全景声', tencent: '臻品全景声', vip: false, svip: true },
    'master': { name: '臻品母带', tencent: '臻品母带', vip: false, svip: true },
}

export const isValidQuality = (server, quality) => {
    if (!quality) return true
    return VALID_QUALITY[server]?.includes(quality.toLowerCase()) ?? false
}

export const getQualityName = (quality, server) => {
    if (!quality) return server === 'tencent' ? '标准品质' : '标准'
    const meta = QUALITY_META[quality.toLowerCase()]
    if (!meta) return quality
    if (server === 'tencent' && meta.tencent) return meta.tencent
    return meta.name
}

/** 统一 type=url 的返回结构：仅 url + 实际音质中文名 */
export const buildUrlPayload = (url, actualQuality, requestedQuality, server) => {
    if (!url) return null
    const quality = (actualQuality || requestedQuality || 'standard').toLowerCase()
    return {
        url,
        quality: getQualityName(quality, server),
    }
}
