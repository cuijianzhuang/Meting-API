export const resolveLoudnessServiceUrl = (savedUrl = '', environmentUrl = '') => {
    const saved = String(savedUrl || '').trim()
    return saved || String(environmentUrl || '').trim()
}
