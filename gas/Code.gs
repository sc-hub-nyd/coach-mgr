/*
 * CoachMgr secure GAS sync API (P16)
 *
 * Required Script Properties:
 *   COACHMGR_AUTH_TOKEN      24文字以上のランダムな認証トークン
 *   COACHMGR_SPREADSHEET_ID  スタンドアロンGASでは必須。スプレッドシートに紐付く
 *                            GASでは省略可。
 *
 * POST text/plain JSON only:
 *   { action: 'pull' | 'push' | 'listRecoveries' | 'restore', sheetName, authToken, ... }
 *
 * P16 uses two payload slots in the target sheet. A new payload is fully written to
 * the inactive slot before the active-slot metadata is switched. Therefore, an
 * interrupted write leaves the last confirmed slot readable. Older generations are
 * also retained in a hidden archive sheet.
 */

const COACHMGR_CONFIG = Object.freeze({
  TOKEN_PROPERTY: 'COACHMGR_AUTH_TOKEN',
  SPREADSHEET_ID_PROPERTY: 'COACHMGR_SPREADSHEET_ID',
  FORMAT_V1: 'coachmgr-secure-snapshot-v1',
  FORMAT_V2: 'coachmgr-secure-snapshot-v2',
  MAX_SNAPSHOT_BYTES: 5 * 1024 * 1024,
  MAX_CELL_CHARS: 49000,
  MAX_CHUNKS: 2000,
  CHUNK_START_ROW: 4,
  MAX_ARCHIVES: 4,
  LOCK_WAIT_MS: 10000
});

function doGet(_event) {
  // GET parameters are logged by many intermediaries. Never return team data
  // or accept an authentication token from a URL.
  return jsonError_('method_not_allowed', 'このAPIはPOSTのみを受け付けます。安全モードを使用してください。');
}

function doPost(event) {
  try {
    const payload = parsePayload_(event);
    if (!isAuthorized_(payload.authToken)) {
      return jsonError_('unauthorized', '認証に失敗しました。');
    }

    const action = String(payload.action || '').toLowerCase();
    const sheet = getTargetSheet_(payload.sheetName);
    if (action === 'pull') {
      const snapshot = readSnapshot_(sheet);
      return jsonSuccess_({ data: decorateSnapshotForClient_(snapshot), meta: publicMeta_(snapshot.meta) });
    }
    if (action === 'listrecoveries') {
      return jsonSuccess_({ recoveries: listRecoveryGenerations_(sheet) });
    }
    if (action === 'push') {
      if (!isPlainObject_(payload.data)) {
        return jsonError_('invalid_data', '保存データの形式が正しくありません。');
      }
      return pushSnapshot_(sheet, payload);
    }
    if (action === 'restore') {
      return restoreSnapshot_(sheet, payload);
    }
    return jsonError_('invalid_action', 'action は pull、push、listRecoveries、restore のいずれかを指定してください。');
  } catch (error) {
    // Do not send stack traces or configuration values to the client.
    console.error(`CoachMgr API error: ${error && error.message ? error.message : error}`);
    return jsonError_('server_error', 'クラウド処理に失敗しました。設定と実行ログを確認してください。');
  }
}

function pushSnapshot_(sheet, payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(COACHMGR_CONFIG.LOCK_WAIT_MS);
  try {
    const current = tryReadSnapshot_(sheet);
    const currentRevision = Number(current && current.meta.revision || 0);
    if (!revisionIsAccepted_(payload, currentRevision)) {
      return jsonError_('revision_conflict', 'クラウド側に新しい変更があります。受信して内容を確認してください。', {
        revision: currentRevision,
        updatedAt: current && current.meta.updatedAt || null,
        recoveryAvailable: Boolean(current && current.meta.recoveryAvailable)
      });
    }

    const nextRevision = currentRevision + 1;
    const written = writeSnapshotAtomically_(sheet, payload.data, {
      revision: nextRevision,
      previousRevision: currentRevision,
      recoveryCount: current ? Math.min(COACHMGR_CONFIG.MAX_ARCHIVES, Number(current.meta.recoveryCount || 0) + 1) : 0
    });
    archivePreviousSnapshotSafely_(sheet, current);
    return jsonSuccess_({ meta: publicMeta_(written.meta) });
  } finally {
    lock.releaseLock();
  }
}

function restoreSnapshot_(sheet, payload) {
  const requestedRevision = Number(payload.revision);
  if (!Number.isInteger(requestedRevision) || requestedRevision < 0) {
    return jsonError_('invalid_revision', '復元する世代が正しくありません。');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(COACHMGR_CONFIG.LOCK_WAIT_MS);
  try {
    const current = tryReadSnapshot_(sheet);
    const currentRevision = Number(current && current.meta.revision || 0);
    if (!revisionIsAccepted_(payload, currentRevision)) {
      return jsonError_('revision_conflict', 'クラウド側に新しい変更があります。再度確認してください。', {
        revision: currentRevision,
        updatedAt: current && current.meta.updatedAt || null,
        recoveryAvailable: Boolean(current && current.meta.recoveryAvailable)
      });
    }

    const recovery = readRecoverySnapshot_(sheet, requestedRevision);
    if (!recovery) return jsonError_('recovery_not_found', '指定した復旧世代が見つかりません。');
    const written = writeSnapshotAtomically_(sheet, recovery.data, {
      revision: currentRevision + 1,
      previousRevision: currentRevision,
      recoveryCount: Math.min(COACHMGR_CONFIG.MAX_ARCHIVES, Number(current && current.meta.recoveryCount || 0) + 1),
      restoredFrom: requestedRevision
    });
    archivePreviousSnapshotSafely_(sheet, current);
    return jsonSuccess_({ meta: publicMeta_(written.meta), restoredFrom: requestedRevision });
  } finally {
    lock.releaseLock();
  }
}

function revisionIsAccepted_(payload, currentRevision) {
  // P10 clients did not send expectedRevision. Preserve compatibility for them,
  // while P15/P16 clients always send a concrete observed server generation.
  if (!Object.prototype.hasOwnProperty.call(payload, 'expectedRevision')) return true;
  if (payload.force === true) return true;
  return Number(payload.expectedRevision) === Number(currentRevision);
}

function writeSnapshotAtomically_(sheet, data, { revision, previousRevision, recoveryCount, restoredFrom } = {}) {
  const current = tryReadSnapshot_(sheet);
  const activeSlot = current && current.meta.format === COACHMGR_CONFIG.FORMAT_V2 ? Number(current.meta.activeSlot) : 0;
  const inactiveSlot = activeSlot === 0 ? 1 : 0;
  const updatedAt = new Date().toISOString();
  const normalizedData = normalizeDataForStorage_(data, {
    revision: Number(revision || 1),
    updatedAt,
    recoveryAvailable: Number(previousRevision || 0) > 0
  });
  const serialized = JSON.stringify(normalizedData);
  assertSnapshotSize_(serialized);
  const chunks = splitIntoChunks_(serialized, COACHMGR_CONFIG.MAX_CELL_CHARS);
  const checksum = sha256_(serialized);

  // Stage the complete payload in the inactive column first. The active slot and
  // its verified metadata are untouched until every chunk has been written.
  ensurePayloadGrid_(sheet);
  clearSlot_(sheet, inactiveSlot);
  sheet.getRange(COACHMGR_CONFIG.CHUNK_START_ROW, inactiveSlot + 1, chunks.length, 1)
    .setValues(chunks.map(chunk => [chunk]));
  setSlotMetadata_(sheet, inactiveSlot, chunks.length, checksum);

  // One metadata write is the commit point. Readers resolve activeSlot only.
  const header = [
    COACHMGR_CONFIG.FORMAT_V2,
    inactiveSlot,
    updatedAt,
    Number(revision || 1),
    Number(previousRevision || 0),
    Number(recoveryCount || 0),
    getSlotMetadata_(sheet, 0).chunkCount,
    getSlotMetadata_(sheet, 0).checksum,
    getSlotMetadata_(sheet, 1).chunkCount,
    getSlotMetadata_(sheet, 1).checksum
  ];
  sheet.getRange(1, 1, 1, 10).setValues([['format', 'activeSlot', 'updatedAt', 'revision', 'previousRevision', 'recoveryCount', 'slot0ChunkCount', 'slot0Sha256', 'slot1ChunkCount', 'slot1Sha256']]);
  sheet.getRange(2, 1, 1, 10).setValues([header]);
  sheet.getRange(3, 1, 1, 2).setValues([['payloadSlot0', 'payloadSlot1']]);

  return {
    data: normalizedData,
    meta: {
      format: COACHMGR_CONFIG.FORMAT_V2,
      activeSlot: inactiveSlot,
      revision: Number(revision || 1),
      previousRevision: Number(previousRevision || 0),
      recoveryCount: Number(recoveryCount || 0),
      updatedAt,
      recoveryAvailable: Number(previousRevision || 0) > 0,
      restoredFrom: restoredFrom || null
    }
  };
}

function readSnapshot_(sheet) {
  const snapshot = tryReadSnapshot_(sheet);
  if (!snapshot) throw new Error('valid snapshot not found');
  return snapshot;
}

function tryReadSnapshot_(sheet) {
  const header = sheet.getRange(2, 1, 1, 10).getValues()[0];
  const format = String(header[0] || '');
  if (format === COACHMGR_CONFIG.FORMAT_V2) {
    const activeSlot = Number(header[1]);
    const revision = Number(header[3]);
    if (![0, 1].includes(activeSlot) || !Number.isInteger(revision) || revision < 1) throw new Error('stored snapshot metadata is invalid');
    const slotMeta = getSlotMetadata_(sheet, activeSlot, header);
    const data = parseSerializedSnapshot_(readSlot_(sheet, activeSlot, slotMeta), slotMeta.checksum);
    return {
      data,
      meta: {
        format,
        activeSlot,
        updatedAt: String(header[2] || ''),
        revision,
        previousRevision: Number(header[4] || 0),
        recoveryCount: Number(header[5] || 0),
        recoveryAvailable: Number(header[4] || 0) > 0
      }
    };
  }
  if (format === COACHMGR_CONFIG.FORMAT_V1) return readV1Snapshot_(sheet, header);
  return null;
}

function readV1Snapshot_(sheet, header) {
  const chunkCount = Number(header[2]);
  const expectedChecksum = String(header[3] || '');
  if (!Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > COACHMGR_CONFIG.MAX_CHUNKS) {
    throw new Error('valid snapshot not found');
  }
  const serialized = sheet.getRange(COACHMGR_CONFIG.CHUNK_START_ROW, 1, chunkCount, 1)
    .getDisplayValues().map(row => row[0]).join('');
  return {
    data: parseSerializedSnapshot_(serialized, expectedChecksum),
    meta: { format: COACHMGR_CONFIG.FORMAT_V1, activeSlot: 0, revision: 0, previousRevision: 0, recoveryCount: 0, updatedAt: String(header[1] || ''), recoveryAvailable: false }
  };
}

function decorateSnapshotForClient_(snapshot) {
  const data = JSON.parse(JSON.stringify(snapshot.data));
  data.syncMeta = isPlainObject_(data.syncMeta) ? data.syncMeta : {};
  data.syncMeta.cloudRevision = Number(snapshot.meta.revision || 0);
  data.syncMeta.lastKnownCloudRevision = Number(snapshot.meta.revision || 0);
  data.syncMeta.cloudUpdatedAt = snapshot.meta.updatedAt || null;
  data.syncMeta.cloudRecoveryAvailable = Boolean(snapshot.meta.recoveryAvailable);
  return data;
}

function normalizeDataForStorage_(data, { revision, updatedAt, recoveryAvailable }) {
  const normalized = JSON.parse(JSON.stringify(data));
  normalized.syncMeta = isPlainObject_(normalized.syncMeta) ? normalized.syncMeta : {};
  normalized.syncMeta.cloudRevision = revision;
  normalized.syncMeta.lastKnownCloudRevision = revision;
  normalized.syncMeta.cloudUpdatedAt = updatedAt;
  normalized.syncMeta.cloudRecoveryAvailable = Boolean(recoveryAvailable);
  normalized.syncMeta.updatedAt = updatedAt;
  return normalized;
}

function getSlotMetadata_(sheet, slot, header) {
  const values = header || sheet.getRange(2, 1, 1, 10).getValues()[0];
  const offset = slot === 0 ? 6 : 8;
  return { chunkCount: Number(values[offset] || 0), checksum: String(values[offset + 1] || '') };
}

function setSlotMetadata_(sheet, slot, chunkCount, checksum) {
  const startColumn = slot === 0 ? 7 : 9;
  sheet.getRange(2, startColumn, 1, 2).setValues([[chunkCount, checksum]]);
}

function ensurePayloadGrid_(sheet) {
  const requiredRows = COACHMGR_CONFIG.CHUNK_START_ROW + COACHMGR_CONFIG.MAX_CHUNKS - 1;
  if (sheet.getMaxRows() < requiredRows) sheet.insertRowsAfter(sheet.getMaxRows(), requiredRows - sheet.getMaxRows());
  if (sheet.getMaxColumns() < 10) sheet.insertColumnsAfter(sheet.getMaxColumns(), 10 - sheet.getMaxColumns());
}

function clearSlot_(sheet, slot) {
  sheet.getRange(COACHMGR_CONFIG.CHUNK_START_ROW, slot + 1, COACHMGR_CONFIG.MAX_CHUNKS, 1).clearContent();
}

function readSlot_(sheet, slot, slotMeta) {
  const count = Number(slotMeta.chunkCount);
  if (!Number.isInteger(count) || count < 1 || count > COACHMGR_CONFIG.MAX_CHUNKS || !slotMeta.checksum) {
    throw new Error('stored payload slot is invalid');
  }
  return sheet.getRange(COACHMGR_CONFIG.CHUNK_START_ROW, slot + 1, count, 1)
    .getDisplayValues().map(row => row[0]).join('');
}

function parseSerializedSnapshot_(serialized, expectedChecksum) {
  if (sha256_(serialized) !== expectedChecksum) throw new Error('snapshot integrity check failed');
  try {
    const data = JSON.parse(serialized);
    if (!isPlainObject_(data)) throw new Error('not object');
    return data;
  } catch (_error) {
    throw new Error('stored snapshot is invalid');
  }
}

function archivePreviousSnapshotSafely_(sheet, previous) {
  if (!previous || !previous.data || !Number(previous.meta.revision)) return;
  try {
    const archive = getArchiveSheet_(sheet);
    const serialized = JSON.stringify(previous.data);
    assertSnapshotSize_(serialized);
    const checksum = sha256_(serialized);
    const chunks = splitIntoChunks_(serialized, COACHMGR_CONFIG.MAX_CELL_CHARS);
    const rows = chunks.map((chunk, index) => [Number(previous.meta.revision), previous.meta.updatedAt || '', chunks.length, index, checksum, chunk]);
    archive.getRange(archive.getLastRow() + 1, 1, rows.length, 6).setValues(rows);
    trimArchive_(archive);
  } catch (error) {
    // The two main slots still retain the immediate previous version. A history
    // write failure must not report a committed snapshot as a failed push.
    console.error(`CoachMgr archive warning: ${error && error.message ? error.message : error}`);
  }
}

function getArchiveSheet_(sheet) {
  const spreadsheet = sheet.getParent();
  const name = `__coachmgr_archive_${sheet.getSheetId()}`;
  let archive = spreadsheet.getSheetByName(name);
  if (!archive) {
    archive = spreadsheet.insertSheet(name);
    archive.getRange(1, 1, 1, 6).setValues([['revision', 'updatedAt', 'chunkCount', 'chunkIndex', 'sha256', 'payload']]);
    archive.hideSheet();
  }
  return archive;
}

function trimArchive_(archive) {
  const lastRow = archive.getLastRow();
  if (lastRow <= 1) return;
  const rows = archive.getRange(2, 1, lastRow - 1, 6).getValues();
  const revisions = [...new Set(rows.map(row => Number(row[0])).filter(value => Number.isInteger(value) && value >= 0))]
    .sort((a, b) => b - a).slice(0, COACHMGR_CONFIG.MAX_ARCHIVES);
  const retained = rows.filter(row => revisions.includes(Number(row[0])));
  archive.getRange(2, 1, Math.max(1, lastRow - 1), 6).clearContent();
  if (retained.length) archive.getRange(2, 1, retained.length, 6).setValues(retained);
}

function listRecoveryGenerations_(sheet) {
  const current = tryReadSnapshot_(sheet);
  if (!current) return [];
  const recoveries = [];
  if (current.meta.format === COACHMGR_CONFIG.FORMAT_V2 && Number(current.meta.previousRevision) > 0) {
    const previousSlot = Number(current.meta.activeSlot) === 0 ? 1 : 0;
    const slotMeta = getSlotMetadata_(sheet, previousSlot);
    try {
      parseSerializedSnapshot_(readSlot_(sheet, previousSlot, slotMeta), slotMeta.checksum);
      recoveries.push({ revision: Number(current.meta.previousRevision), updatedAt: null, source: 'immediate' });
    } catch (_error) {
      // Do not expose an unusable recovery option.
    }
  }
  const archive = sheet.getParent().getSheetByName(`__coachmgr_archive_${sheet.getSheetId()}`);
  if (archive && archive.getLastRow() > 1) {
    const rows = archive.getRange(2, 1, archive.getLastRow() - 1, 6).getValues();
    const byRevision = new Map();
    rows.forEach(row => {
      const revision = Number(row[0]);
      if (!byRevision.has(revision)) byRevision.set(revision, { revision, updatedAt: String(row[1] || ''), source: 'archive' });
    });
    byRevision.forEach(item => {
      if (!recoveries.some(recovery => recovery.revision === item.revision)) recoveries.push(item);
    });
  }
  return recoveries.sort((a, b) => b.revision - a.revision).slice(0, COACHMGR_CONFIG.MAX_ARCHIVES);
}

function readRecoverySnapshot_(sheet, requestedRevision) {
  const current = tryReadSnapshot_(sheet);
  if (current && current.meta.format === COACHMGR_CONFIG.FORMAT_V2 && Number(current.meta.previousRevision) === requestedRevision) {
    const slot = Number(current.meta.activeSlot) === 0 ? 1 : 0;
    const meta = getSlotMetadata_(sheet, slot);
    return { data: parseSerializedSnapshot_(readSlot_(sheet, slot, meta), meta.checksum), meta: { revision: requestedRevision } };
  }
  const archive = sheet.getParent().getSheetByName(`__coachmgr_archive_${sheet.getSheetId()}`);
  if (!archive || archive.getLastRow() <= 1) return null;
  const rows = archive.getRange(2, 1, archive.getLastRow() - 1, 6).getValues()
    .filter(row => Number(row[0]) === requestedRevision)
    .sort((a, b) => Number(a[3]) - Number(b[3]));
  if (!rows.length) return null;
  const expectedCount = Number(rows[0][2]);
  const expectedChecksum = String(rows[0][4] || '');
  if (rows.length !== expectedCount || rows.some((row, index) => Number(row[3]) !== index || String(row[4] || '') !== expectedChecksum)) return null;
  return { data: parseSerializedSnapshot_(rows.map(row => row[5]).join(''), expectedChecksum), meta: { revision: requestedRevision } };
}

function publicMeta_(meta) {
  return {
    revision: Number(meta.revision || 0),
    previousRevision: Number(meta.previousRevision || 0),
    updatedAt: meta.updatedAt || null,
    recoveryAvailable: Boolean(meta.recoveryAvailable),
    recoveryCount: Number(meta.recoveryCount || 0),
    restoredFrom: meta.restoredFrom || null
  };
}

function assertSnapshotSize_(serialized) {
  const bytes = Utilities.newBlob(serialized).getBytes().length;
  if (bytes > COACHMGR_CONFIG.MAX_SNAPSHOT_BYTES) throw new Error('snapshot is too large');
}

function parsePayload_(event) {
  const raw = event && event.postData && event.postData.contents;
  if (!raw || raw.length > COACHMGR_CONFIG.MAX_SNAPSHOT_BYTES + 8192) {
    throw new Error('invalid request body');
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_error) {
    throw new Error('invalid json');
  }
  if (!isPlainObject_(payload)) throw new Error('invalid payload');
  return payload;
}

function isAuthorized_(providedToken) {
  const expectedToken = PropertiesService.getScriptProperties().getProperty(COACHMGR_CONFIG.TOKEN_PROPERTY);
  if (!expectedToken || expectedToken.length < 24 || typeof providedToken !== 'string') return false;
  return constantTimeEquals_(expectedToken, providedToken);
}

function constantTimeEquals_(left, right) {
  const a = String(left);
  const b = String(right);
  let mismatch = a.length ^ b.length;
  const maxLength = Math.max(a.length, b.length);
  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (a.charCodeAt(index % a.length) || 0) ^ (b.charCodeAt(index % b.length) || 0);
  }
  return mismatch === 0;
}

function getTargetSheet_(requestedName) {
  const sheetName = String(requestedName || '').trim();
  if (!sheetName || sheetName.length > 80 || !/^[\p{L}\p{N} _.-]+$/u.test(sheetName)) throw new Error('invalid sheet name');
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(COACHMGR_CONFIG.SPREADSHEET_ID_PROPERTY);
  const spreadsheet = spreadsheetId ? SpreadsheetApp.openById(spreadsheetId) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('spreadsheet is not configured');
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('sheet not found');
  return sheet;
}

function splitIntoChunks_(text, size) {
  const chunks = [];
  for (let index = 0; index < text.length; index += size) chunks.push(text.slice(index, index + size));
  return chunks.length ? chunks : ['{}'];
}

function sha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text)
    .map(byte => {
      const normalized = byte < 0 ? byte + 256 : byte;
      return (`0${normalized.toString(16)}`).slice(-2);
    }).join('');
}

function isPlainObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonSuccess_(payload) {
  return json_({ status: 'success', ...payload });
}

function jsonError_(code, message, meta) {
  return json_({ status: 'error', code, message, ...(meta ? { meta } : {}) });
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);
}
