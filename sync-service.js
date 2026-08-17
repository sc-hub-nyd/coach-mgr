export class SyncError extends Error {
    constructor(message, { kind = 'unknown', retryable = false, status = 0, cause } = {}) {
        super(message, { cause });
        this.name = 'SyncError';
        this.kind = kind;
        this.retryable = retryable;
        this.status = status;
    }
}

function assertUrl(url) {
    if (!url) throw new SyncError('Google Apps ScriptのWeb API URLが設定されていません', { kind: 'configuration' });
    try {
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol)) throw new Error('unsupported protocol');
    } catch (error) {
        throw new SyncError('Google Apps ScriptのWeb API URLが正しくありません', { kind: 'configuration', cause: error });
    }
    return url;
}

function classifyFetchError(error) {
    if (error instanceof SyncError) return error;
    return new SyncError('ネットワーク接続を確認してください', { kind: 'network', retryable: true, cause: error });
}

async function fetchWithTimeout(fetchImpl, url, options = {}, timeoutMs = 10000) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => controller?.abort(), timeoutMs);
    try {
        return await fetchImpl(url, controller ? { ...options, signal: controller.signal } : options);
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new SyncError('クラウド同期がタイムアウトしました', { kind: 'timeout', retryable: true, cause: error });
        }
        throw classifyFetchError(error);
    } finally {
        clearTimeout(timer);
    }
}

async function parseResponse(response, direction) {
    if (!response?.ok) {
        const status = Number(response?.status || 0);
        throw new SyncError(`${direction}に失敗しました (${status || '通信エラー'})`, {
            kind: status >= 500 || status === 429 ? 'server' : 'http',
            retryable: status >= 500 || status === 429 || status === 0,
            status
        });
    }
    let result;
    try {
        result = await response.json();
    } catch (error) {
        throw new SyncError(`${direction}のレスポンス形式が正しくありません`, { kind: 'response', retryable: false, cause: error });
    }
    if (!result || result.status !== 'success') {
        throw new SyncError(result?.message || `${direction}に失敗しました`, {
            kind: 'api', retryable: false
        });
    }
    return result;
}

export function createCloudPayload(teamInfo, data) {
    return {
        action: 'push',
        sheetName: teamInfo?.gasSheetName || '',
        authToken: teamInfo?.gasAuthToken || '',
        data
    };
}

export async function pushCloud({ teamInfo, data, fetchImpl = fetch, timeoutMs = 10000 }) {
    const url = assertUrl(teamInfo?.gasApiUrl);
    const response = await fetchWithTimeout(fetchImpl, url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(createCloudPayload(teamInfo, data))
    }, timeoutMs);
    return parseResponse(response, 'クラウド送信');
}

export async function pullCloud({ teamInfo, fetchImpl = fetch, timeoutMs = 10000 }) {
    const url = assertUrl(teamInfo?.gasApiUrl);
    const params = new URLSearchParams({ action: 'pull', t: String(Date.now()) });
    if (teamInfo?.gasSheetName) params.set('sheetName', teamInfo.gasSheetName);
    if (teamInfo?.gasAuthToken) params.set('authToken', teamInfo.gasAuthToken);
    const response = await fetchWithTimeout(fetchImpl, `${url}?${params.toString()}`, {
        method: 'GET', mode: 'cors', redirect: 'follow'
    }, timeoutMs);
    const result = await parseResponse(response, 'クラウド受信');
    if (!result.data) throw new SyncError('有効なクラウドデータが見つかりませんでした', { kind: 'data', retryable: false });
    let data = result.data;
    try {
        if (typeof data === 'string') data = JSON.parse(data);
    } catch (error) {
        throw new SyncError('クラウドデータのJSON形式が正しくありません', { kind: 'data', retryable: false, cause: error });
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new SyncError('クラウドデータの形式が正しくありません', { kind: 'data', retryable: false });
    }
    return data;
}

export async function withRetry(operation, {
    retries = 2,
    baseDelayMs = 400,
    sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
    onRetry
} = {}) {
    let attempt = 0;
    while (true) {
        try {
            return await operation(attempt);
        } catch (error) {
            const normalized = classifyFetchError(error);
            if (!normalized.retryable || attempt >= retries) throw normalized;
            attempt += 1;
            onRetry?.(normalized, attempt);
            await sleep(baseDelayMs * (2 ** (attempt - 1)));
        }
    }
}

export { assertUrl };
