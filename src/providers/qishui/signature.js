export const buildQishuiSignatureHeaderList = (headers = {}) => Object.entries(headers)
    .filter(([name]) => !/^(cookie|host|content-length|x-helios|x-medusa)$/i.test(name))
    .flatMap(([name, value]) => [name.toLowerCase(), String(value)])

export const buildQishuiSignerPayload = ({ url, headers, deviceId }) => ({
    deviceId: String(deviceId),
    url: String(url),
    headers: buildQishuiSignatureHeaderList(headers),
})

export const parseQishuiSignatureHeaders = raw => {
    const parts = String(raw || '').split('\r\n').filter(Boolean)
    const headers = {}
    for (let index = 0; index + 1 < parts.length; index += 2) headers[parts[index]] = parts[index + 1]
    return headers
}

const validateResult = result => {
    if (!result?.['X-Helios'] || !result?.['X-Medusa']) throw new Error('汽水动态签名返回字段不完整')
    return { 'X-Helios': result['X-Helios'], 'X-Medusa': result['X-Medusa'] }
}
const signRemotely = async (endpoint, payload) => {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    })
    const result = await response.json().catch(() => ({}))
    if (!response.ok || !result.ok) throw new Error(result.error || `汽水远程签名服务 HTTP ${response.status}`)
    return validateResult(result)
}

export const isQishuiRemoteSignerConfigured = signerUrl => Boolean(String(signerUrl || process.env.QISHUI_SIGNER_URL || '').trim())

export const generateQishuiSignatureHeaders = async ({ url, headers, deviceId, signerUrl = '' }) => {
    const payload = buildQishuiSignerPayload({ url, headers, deviceId })
    const endpoint = String(signerUrl || process.env.QISHUI_SIGNER_URL || '').trim()
    if (!endpoint) throw new Error('汽水签名接口未配置')
    return signRemotely(endpoint, payload)
}
