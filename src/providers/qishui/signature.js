import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const DEFAULT_SIGNER = 'D:/Soda Music/reverse-evidence/reproduce-x-helios-medusa.js'
const DEFAULT_BDMS = 'D:/Soda Music/3.5.1/resources/app.asar.unpacked/bdms.node'

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

const signLocally = payload => {
    const signer = process.env.QISHUI_SIGNER_SCRIPT || DEFAULT_SIGNER
    const bdms = process.env.QISHUI_BDMS_PATH || DEFAULT_BDMS
    if (!fs.existsSync(signer)) throw new Error(`汽水签名脚本不存在: ${signer}`)
    if (!fs.existsSync(bdms)) throw new Error(`汽水 bdms 模块不存在: ${bdms}`)
    const output = execFileSync(process.execPath, [signer], {
        input: JSON.stringify(payload) + '\n',
        env: { ...process.env, SODA_BDMS: bdms }, encoding: 'utf8', maxBuffer: 1024 * 1024,
    })
    return validateResult(JSON.parse(output).headers)
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

export const generateQishuiSignatureHeaders = async ({ url, headers, deviceId, signerUrl = '' }) => {
    const payload = buildQishuiSignerPayload({ url, headers, deviceId })
    const endpoint = String(signerUrl || process.env.QISHUI_SIGNER_URL || '').trim()
    return endpoint ? signRemotely(endpoint, payload) : signLocally(payload)
}
