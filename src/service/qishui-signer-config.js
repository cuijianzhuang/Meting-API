export const resolveQishuiSignerUrl = (savedUrl = '', environmentUrl = globalThis?.process?.env?.QISHUI_SIGNER_URL || '') => {
    const saved = String(savedUrl || '').trim()
    return saved || String(environmentUrl || '').trim()
}
