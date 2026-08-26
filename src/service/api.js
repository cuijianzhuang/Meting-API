import Providers from "../providers/index.js"
import { format as lyricFormat, get_url } from "../util.js"
import { wrapQishuiPlayPayload } from "../providers/qishui/audio.js"
import store from "../admin/store.js"
import { isValidQuality, getQualityName, buildUrlPayload } from "../quality.js"
import { resolveQishuiSignerUrl } from './qishui-signer-config.js'
export default async (ctx) => {

    const p = new Providers()

    const query = ctx.req.query()
    const server = query.server || 'netease'
    const type = query.type || 'playlist'
    const id = query.id || '6907557348'
    const quality = query.quality?.toLowerCase()
    const wantRedirect = query.redirect === '1' || query.redirect === 'true'

    if (!p.get_provider_list().includes(server) || !p.get(server).support_type.includes(type)) {
        ctx.status(400)
        return ctx.json({ status: 400, message: 'server 参数不合法', param: { server, type, id } })
    }

    if (!isValidQuality(server, quality)) {
        ctx.status(400)
        return ctx.json({ status: 400, message: 'quality 参数不合法', param: { server, quality } })
    }

    let cookie = ''
    const storedCookie = store.getActiveCookie(server)
    if (storedCookie) {
        cookie = storedCookie.cookie
    }

    const signerUrl = server === 'qishui' ? resolveQishuiSignerUrl(store.getQishuiSignerUrl()) : ''
    if (server === 'qishui' && type === 'url') {
        console.log('[Meting] qishui signer config', JSON.stringify({
            configured: Boolean(signerUrl),
            source: store.getQishuiSignerUrl() ? 'admin' : (process.env.QISHUI_SIGNER_URL ? 'env' : 'none'),
        }))
    }
    let data = await p.get(server).handle(type, id, cookie, { quality, signerUrl })

    if (type === 'url') {
        // 兼容旧返回：纯字符串 URL
        const payload = typeof data === 'string'
            ? buildUrlPayload(data, quality || 'standard', quality || 'standard', server)
            : data

        let url = payload?.url || ''
        if (!url) {
            console.warn('[Meting] no url', JSON.stringify({
                server,
                type,
                id,
                requestedQuality: quality || 'standard',
                hasActiveCookie: Boolean(cookie),
                cookieValid: storedCookie?.isValid !== false,
                cookieVip: Boolean(storedCookie?.userInfo?.canPlayVip),
                cookieSvip: Boolean(storedCookie?.userInfo?.canPlaySvip),
            }))
            ctx.status(403)
            return ctx.json({ error: 'no url' })
        }
        if (server === 'qishui' && payload?.auth) {
            const wrapped = wrapQishuiPlayPayload(ctx, payload)
            url = wrapped.url || url
            payload.url = url
        }
        if (url.startsWith('@')) {
            return ctx.text(url)
        }

        // 默认 JSON：url + 实际音质；redirect=1 时 302，兼容 Meting 等播放器
        if (wantRedirect) {
            return ctx.redirect(url)
        }

        return ctx.json({
            url,
            quality: payload.quality || getQualityName(quality || 'standard', server),
            duration: payload.duration,
            loudness: payload.loudness || null,
        })
    }

    if (type === 'pic') {
        return ctx.redirect(data)
    }

    if (type === 'lrc') {
        return ctx.text(lyricFormat(data.lyric, data.tlyric || ''))
    }


    return ctx.json(data.map(x => {
        for (let i of ['url', 'pic', 'lrc']) {
            const _ = String(x[i])
            if (!_.startsWith('@') && !_.startsWith('http') && _.length > 0) {
                const qualityParam = i === 'url' && quality ? `&quality=${quality}` : ''
                const redirectParam = i === 'url' ? '&redirect=1' : ''
                let linkType = i
                if (i === 'url') {
                    if (type === 'search_playlist') linkType = 'playlist'
                    else if (type === 'dj_hot' || type === 'dj_detail' || type === 'search_dj') linkType = 'dj'
                }
                x[i] = `${get_url(ctx)}?server=${server}&type=${linkType}&id=${_}${qualityParam}${redirectParam}`
            }
        }
        return x
    }))
}
