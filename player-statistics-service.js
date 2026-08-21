// player-statistics-service.js
// ダッシュボードと選手詳細で共有する選手別の参加・得点・アシスト集計。

import { getNendo } from './utils.js';

function hasPlayerId(ids, playerId) {
    return Array.isArray(ids) && ids.some(id => String(id) === String(playerId));
}

function getPresentPlayerIds(event) {
    // 現行のpresentPlayerIdsと旧データのattendedPlayerIdsを互換的に扱う。
    if (Array.isArray(event?.presentPlayerIds)) return event.presentPlayerIds;
    if (Array.isArray(event?.attendedPlayerIds)) return event.attendedPlayerIds;
    return [];
}

export function getMatchGoalRecords(match) {
    const rootRecords = Array.isArray(match?.goalRecords) ? match.goalRecords : [];
    if (rootRecords.length) return rootRecords;

    return (match?.formations || []).flatMap(formation => (
        Array.isArray(formation?.goalRecords) ? formation.goalRecords : []
    ));
}

export function isPlayerInMatch(match, playerId) {
    const isInFormation = (match?.formations || []).some(formation => (
        Array.isArray(formation?.slots)
        && formation.slots.some(slot => String(slot?.playerId) === String(playerId))
    ));

    return isInFormation || hasPlayerId(getPresentPlayerIds(match), playerId);
}

export function getPlayerStatistics(player, { matches = [], practices = [], referenceDate = new Date() } = {}) {
    const currentNendo = getNendo(referenceDate.toISOString().slice(0, 10));
    const allMatches = Array.isArray(matches) ? matches : [];
    const allPractices = Array.isArray(practices) ? practices : [];
    const currentYearMatches = allMatches.filter(match => getNendo(match?.date) === currentNendo);
    const currentYearPractices = allPractices.filter(practice => getNendo(practice?.date) === currentNendo);

    const attendedMatches = currentYearMatches.filter(match => hasPlayerId(getPresentPlayerIds(match), player.id));
    const attendedPractices = currentYearPractices.filter(practice => hasPlayerId(getPresentPlayerIds(practice), player.id));
    const attendanceDenominator = currentYearMatches.length + currentYearPractices.length;
    const attendanceNumerator = attendedMatches.length + attendedPractices.length;

    let goals = 0;
    let assists = 0;
    allMatches.forEach(match => {
        getMatchGoalRecords(match).forEach(record => {
            if (String(record?.scorerId) === String(player.id)) goals += 1;
            if (String(record?.assistId) === String(player.id)) assists += 1;
        });
    });

    const appearanceMatches = allMatches.filter(match => isPlayerInMatch(match, player.id));

    return {
        currentNendo,
        attendanceNumerator,
        attendanceDenominator,
        attendanceRate: attendanceDenominator > 0
            ? Math.round((attendanceNumerator / attendanceDenominator) * 100)
            : 0,
        attendedMatches,
        attendedPractices,
        appearanceMatches,
        goals,
        assists
    };
}
