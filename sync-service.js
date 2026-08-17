function assertUrl(url) {
    if (!url) throw new Error('Google Apps ScriptのWeb API URLが設定されていません');
    return url;
}

export function createCloudPayload(teamInfo, data) {
    return {
        action: 'push',
        sheetName: teamInfo?.gasSheetName || '',
        authToken: teamInfo?.gasAuthToken || '',
        data
    };
}

export async function pushCloud({ teamInfo, data, fetchImpl = fetch }) {
    const url = assertUrl(teamInfo?.gasApiUrl);
    const response = await fetchImpl(url, {
        method: 'POST',
        mode: 'cors',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(createCloudPayload(teamInfo, data))
    });
    if (!response.ok) throw new Error(`クラウド送信に失敗しました (${response.status})`);
    const result = await response.json();
    if (!result || result.status !== 'success') {
        throw new Error(result?.message || 'クラウド送信に失敗しました');
    }
    return result;
}

export async function pullCloud({ teamInfo, fetchImpl = fetch }) {
    const url = assertUrl(teamInfo?.gasApiUrl);
    const params = new URLSearchParams({ action: 'pull', t: String(Date.now()) });
    if (teamInfo?.gasSheetName) params.set('sheetName', teamInfo.gasSheetName);
    if (teamInfo?.gasAuthToken) params.set('authToken', teamInfo.gasAuthToken);
    const response = await fetchImpl(`${url}?${params.toString()}`, {
        method: 'GET',
        mode: 'cors',
        redirect: 'follow'
    });
    if (!response.ok) throw new Error(`クラウド受信に失敗しました (${response.status})`);
    const result = await response.json();
    if (!result || result.status !== 'success' || !result.data) {
        throw new Error(result?.message || '有効なクラウドデータが見つかりませんでした');
    }
    let data = result.data;
    if (typeof data === 'string') data = JSON.parse(data);
    if (!data || typeof data !== 'object') throw new Error('クラウドデータの形式が正しくありません');
    return data;
}
