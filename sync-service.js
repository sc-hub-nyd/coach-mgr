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
        const code = String(result?.code || 'api_error');
        const error = new SyncError(result?.message || `${direction}に失敗しました`, {
            kind: code === 'revision_conflict' ? 'conflict' : 'api',
            retryable: false
        });
        error.code = code;
        error.meta = result?.meta && typeof result.meta === 'object' ? result.meta : null;
        throw error;
    }
    return result;
}

export const GAS_SYNC_PROTOCOLS = Object.freeze({
    LEGACY: 'legacy-v1',
    SECURE: 'secure-v2'
});

export function getSyncProtocol(teamInfo) {
    return teamInfo?.gasSyncProtocol === GAS_SYNC_PROTOCOLS.SECURE
        ? GAS_SYNC_PROTOCOLS.SECURE
        : GAS_SYNC_PROTOCOLS.LEGACY;
}

export function createCloudPayload(teamInfo, data, { expectedRevision = 0, force = false } = {}) {
    return {
        action: 'push',
        sheetName: teamInfo?.gasSheetName || '',
        authToken: teamInfo?.gasAuthToken || '',
        expectedRevision: Number.isInteger(Number(expectedRevision)) ? Number(expectedRevision) : 0,
        force: Boolean(force),
        data
    };
}

export function createPullPayload(teamInfo) {
    return {
        action: 'pull',
        sheetName: teamInfo?.gasSheetName || '',
        authToken: teamInfo?.gasAuthToken || ''
    };
}

export async function pushCloud({ teamInfo, data, expectedRevision = 0, force = false, fetchImpl = fetch, timeoutMs = 10000 }) {
    const url = assertUrl(teamInfo?.gasApiUrl);
    const response = await fetchWithTimeout(fetchImpl, url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(createCloudPayload(teamInfo, data, { expectedRevision, force }))
    }, timeoutMs);
    return parseResponse(response, 'クラウド送信');
}

function assertSecureProtocol(teamInfo, featureLabel) {
    if (getSyncProtocol(teamInfo) !== GAS_SYNC_PROTOCOLS.SECURE) {
        throw new SyncError(`${featureLabel}は安全モード（POST認証）でのみ利用できます`, { kind: 'configuration' });
    }
}

async function postSecureAction({ teamInfo, payload, direction, fetchImpl = fetch, timeoutMs = 10000 }) {
    assertSecureProtocol(teamInfo, direction);
    const url = assertUrl(teamInfo?.gasApiUrl);
    const response = await fetchWithTimeout(fetchImpl, url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...payload, sheetName: teamInfo?.gasSheetName || '', authToken: teamInfo?.gasAuthToken || '' })
    }, timeoutMs);
    return parseResponse(response, direction);
}

export async function listCloudRecoveries({ teamInfo, fetchImpl = fetch, timeoutMs = 10000 }) {
    const result = await postSecureAction({
        teamInfo,
        payload: { action: 'listRecoveries' },
        direction: 'クラウド復旧一覧の取得',
        fetchImpl,
        timeoutMs
    });
    return Array.isArray(result.recoveries) ? result.recoveries : [];
}

export async function restoreCloudRecovery({ teamInfo, revision, expectedRevision = 0, force = false, fetchImpl = fetch, timeoutMs = 10000 }) {
    return postSecureAction({
        teamInfo,
        payload: { action: 'restore', revision: Number(revision), expectedRevision: Number(expectedRevision), force: Boolean(force) },
        direction: 'クラウド復旧',
        fetchImpl,
        timeoutMs
    });
}

export async function pullCloud({ teamInfo, fetchImpl = fetch, timeoutMs = 10000 }) {
    const url = assertUrl(teamInfo?.gasApiUrl);
    const protocol = getSyncProtocol(teamInfo);
    const response = protocol === GAS_SYNC_PROTOCOLS.SECURE
        ? await fetchWithTimeout(fetchImpl, url, {
            method: 'POST',
            mode: 'cors',
            redirect: 'follow',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(createPullPayload(teamInfo))
        }, timeoutMs)
        : await (() => {
            const params = new URLSearchParams({ action: 'pull', t: String(Date.now()) });
            if (teamInfo?.gasSheetName) params.set('sheetName', teamInfo.gasSheetName);
            if (teamInfo?.gasAuthToken) params.set('authToken', teamInfo.gasAuthToken);
            return fetchWithTimeout(fetchImpl, `${url}?${params.toString()}`, {
                method: 'GET', mode: 'cors', redirect: 'follow'
            }, timeoutMs);
        })();
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
