function asArray(value) {
    return Array.isArray(value) ? value : [];
}

function activeRosterCount(period) {
    return asArray(period?.fieldRoster?.activePlayerIds || period?.activePlayerIds || period?.initialActivePlayerIds).length;
}

function currentPeriod(match, periodIndex = 0) {
    const periods = asArray(match?.formations);
    return periods[Math.max(0, Math.min(Number(periodIndex) || 0, Math.max(0, periods.length - 1)))] || null;
}

export function buildMatchdayReadiness({ match, periodIndex = 0, isOnline = true, outboxCount = 0, hasBackup = false } = {}) {
    const period = currentPeriod(match, periodIndex);
    const rosterCount = activeRosterCount(period);
    const hasMatch = Boolean(match?.id);
    const items = [
        {
            id: 'match',
            label: '試合情報',
            detail: hasMatch && match?.date ? `${match.date}${match.opponent ? `・vs ${match.opponent}` : ''}` : '対戦相手・日付を確認してください',
            ready: hasMatch && Boolean(match?.date)
        },
        {
            id: 'roster',
            label: '出場メンバー',
            detail: rosterCount ? `出場中 ${rosterCount}名` : '名簿またはフォーメーションを設定してください',
            ready: rosterCount > 0
        },
        {
            id: 'storage',
            label: '記録の保存先',
            detail: isOnline ? (outboxCount ? `端末保存済み・同期待機 ${outboxCount}件` : '端末保存済み・オンライン') : 'オフラインでも端末に保存します',
            ready: true
        },
        {
            id: 'backup',
            label: '試合前バックアップ',
            detail: hasBackup ? 'バックアップを確認済み' : '試合前にバックアップを推奨します',
            ready: Boolean(hasBackup),
            optional: true
        }
    ];
    const required = items.filter(item => !item.optional);
    return {
        items,
        readyCount: items.filter(item => item.ready).length,
        requiredReady: required.every(item => item.ready),
        headline: required.every(item => item.ready) ? '記録を開始できます' : '開始前に名簿と試合情報を確認してください'
    };
}

export function buildMatchdaySaveStatus({ isOnline = true, outboxCount = 0, syncStatus = 'local' } = {}) {
    if (!isOnline) {
        return {
            tone: 'offline',
            icon: 'ti ti-device-mobile',
            label: 'オフライン：端末に安全保存',
            description: '再接続すると同期待機を自動で再試行します。'
        };
    }
    if (syncStatus === 'conflict') {
        return {
            tone: 'attention',
            icon: 'ti ti-alert-triangle',
            label: '同期の確認が必要です',
            description: '記録は端末に保存済みです。試合後に設定画面で確認してください。'
        };
    }
    if (syncStatus === 'error' || outboxCount) {
        return {
            tone: 'attention',
            icon: 'ti ti-cloud-upload',
            label: `端末に保存済み・同期待機 ${outboxCount || 1}件`,
            description: 'クラウド受領の確認まで記録を保持します。'
        };
    }
    if (syncStatus === 'success') {
        return {
            tone: 'success',
            icon: 'ti ti-cloud-check',
            label: '端末・クラウドに保存済み',
            description: '最新の記録を確認しました。'
        };
    }
    return {
        tone: 'local',
        icon: 'ti ti-server',
        label: '端末に保存済み',
        description: '通信状態にかかわらず、記録はこの端末に残ります。'
    };
}

export function buildMatchdayCloseout(match) {
    const periods = asArray(match?.formations);
    const totals = periods.reduce((result, period) => ({
        us: result.us + Number(period?.scoreUs || 0),
        them: result.them + Number(period?.scoreThem || 0),
        events: result.events + asArray(period?.eventHistory).length
    }), { us: 0, them: 0, events: 0 });
    return {
        score: `${totals.us} - ${totals.them}`,
        eventCount: totals.events,
        periodCount: periods.length,
        nextStep: '記録を確認して、共有または振り返りへ進みます。'
    };
}
