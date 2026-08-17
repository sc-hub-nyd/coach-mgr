/*
 * CoachMgr secure GAS sync API (P10)
 *
 * Required Script Properties:
 *   COACHMGR_AUTH_TOKEN    24文字以上のランダムな認証トークン
 *   COACHMGR_SPREADSHEET_ID  スタンドアロンGASでは必須。スプレッドシートに紐付く
 *                             GASでは省略可。
 *
 * POST text/plain JSON only:
 *   { action: 'pull' | 'push', sheetName, authToken, data? }
 */

const COACHMGR_CONFIG = Object.freeze({
  TOKEN_PROPERTY: 'COACHMGR_AUTH_TOKEN',
  SPREADSHEET_ID_PROPERTY: 'COACHMGR_SPREADSHEET_ID',
  FORMAT: 'coachmgr-secure-snapshot-v1',
  MAX_SNAPSHOT_BYTES: 5 * 1024 * 1024,
  MAX_CELL_CHARS: 49000,
  CHUNK_START_ROW: 4
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
      return jsonSuccess_({ data: readSnapshot_(sheet) });
    }
    if (action === 'push') {
      if (!isPlainObject_(payload.data)) {
        return jsonError_('invalid_data', '保存データの形式が正しくありません。');
      }
      writeSnapshot_(sheet, payload.data);
      return jsonSuccess_({ updatedAt: new Date().toISOString() });
    }
    return jsonError_('invalid_action', 'action は pull または push を指定してください。');
  } catch (error) {
    // Do not send stack traces or configuration values to the client.
    console.error(`CoachMgr API error: ${error && error.message ? error.message : error}`);
    return jsonError_('server_error', 'クラウド処理に失敗しました。設定と実行ログを確認してください。');
  }
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
  const expectedToken = PropertiesService.getScriptProperties()
    .getProperty(COACHMGR_CONFIG.TOKEN_PROPERTY);
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
  if (!sheetName || sheetName.length > 80 || !/^[\p{L}\p{N} _.-]+$/u.test(sheetName)) {
    throw new Error('invalid sheet name');
  }
  const properties = PropertiesService.getScriptProperties();
  const spreadsheetId = properties.getProperty(COACHMGR_CONFIG.SPREADSHEET_ID_PROPERTY);
  const spreadsheet = spreadsheetId
    ? SpreadsheetApp.openById(spreadsheetId)
    : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('spreadsheet is not configured');
  const sheet = spreadsheet.getSheetByName(sheetName);
  if (!sheet) throw new Error('sheet not found');
  return sheet;
}

function writeSnapshot_(sheet, data) {
  const serialized = JSON.stringify(data);
  const bytes = Utilities.newBlob(serialized).getBytes().length;
  if (bytes > COACHMGR_CONFIG.MAX_SNAPSHOT_BYTES) throw new Error('snapshot is too large');

  const chunks = splitIntoChunks_(serialized, COACHMGR_CONFIG.MAX_CELL_CHARS);
  const checksum = sha256_(serialized);
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    sheet.clearContents();
    sheet.getRange(1, 1, 1, 4).setValues([['format', 'updatedAt', 'chunkCount', 'sha256']]);
    sheet.getRange(2, 1, 1, 4).setValues([[
      COACHMGR_CONFIG.FORMAT,
      new Date().toISOString(),
      chunks.length,
      checksum
    ]]);
    sheet.getRange(3, 1).setValue('payloadChunks');
    sheet.getRange(COACHMGR_CONFIG.CHUNK_START_ROW, 1, chunks.length, 1)
      .setValues(chunks.map(chunk => [chunk]));
  } finally {
    lock.releaseLock();
  }
}

function readSnapshot_(sheet) {
  const header = sheet.getRange(2, 1, 1, 4).getValues()[0];
  const format = header[0];
  const chunkCount = Number(header[2]);
  const expectedChecksum = String(header[3] || '');
  if (format !== COACHMGR_CONFIG.FORMAT || !Number.isInteger(chunkCount) || chunkCount < 1 || chunkCount > 2000) {
    throw new Error('valid snapshot not found');
  }
  const serialized = sheet.getRange(COACHMGR_CONFIG.CHUNK_START_ROW, 1, chunkCount, 1)
    .getDisplayValues()
    .map(row => row[0])
    .join('');
  if (sha256_(serialized) !== expectedChecksum) throw new Error('snapshot integrity check failed');
  let data;
  try {
    data = JSON.parse(serialized);
  } catch (_error) {
    throw new Error('stored snapshot is invalid');
  }
  if (!isPlainObject_(data)) throw new Error('stored snapshot is invalid');
  return data;
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
    })
    .join('');
}

function isPlainObject_(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function jsonSuccess_(payload) {
  return json_({ status: 'success', ...payload });
}

function jsonError_(code, message) {
  return json_({ status: 'error', code: code, message: message });
}

function json_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
