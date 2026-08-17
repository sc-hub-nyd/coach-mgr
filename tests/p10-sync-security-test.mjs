import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    GAS_SYNC_PROTOCOLS,
    createPullPayload,
    getSyncProtocol,
    pullCloud
} from '../sync-service.js';

const secureTeam = {
    gasApiUrl: 'https://example.test/secure-gas',
    gasSheetName: 'test',
    gasAuthToken: 'long-enough-token-for-a-secure-test',
    gasSyncProtocol: GAS_SYNC_PROTOCOLS.SECURE
};

assert.equal(getSyncProtocol(secureTeam), GAS_SYNC_PROTOCOLS.SECURE);
assert.equal(getSyncProtocol({}), GAS_SYNC_PROTOCOLS.LEGACY);
assert.deepEqual(createPullPayload(secureTeam), {
    action: 'pull',
    sheetName: 'test',
    authToken: 'long-enough-token-for-a-secure-test'
});

const secureCalls = [];
const fakeSecureFetch = async (url, options) => {
    secureCalls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: { matches: [] } }) };
};
await pullCloud({ teamInfo: secureTeam, fetchImpl: fakeSecureFetch, timeoutMs: 1000 });
assert.equal(secureCalls.length, 1);
assert.equal(secureCalls[0].url, secureTeam.gasApiUrl);
assert.equal(secureCalls[0].options.method, 'POST');
assert.equal(secureCalls[0].options.headers['Content-Type'], 'text/plain;charset=utf-8');
assert.deepEqual(JSON.parse(secureCalls[0].options.body), createPullPayload(secureTeam));
assert.doesNotMatch(secureCalls[0].url, /authToken=/);

const legacyCalls = [];
const fakeLegacyFetch = async (url, options) => {
    legacyCalls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ status: 'success', data: { matches: [] } }) };
};
await pullCloud({
    teamInfo: { ...secureTeam, gasSyncProtocol: GAS_SYNC_PROTOCOLS.LEGACY },
    fetchImpl: fakeLegacyFetch,
    timeoutMs: 1000
});
assert.equal(legacyCalls[0].options.method, 'GET');
assert.match(legacyCalls[0].url, /authToken=long-enough-token-for-a-secure-test/);

const settingsSource = await readFile(new URL('../settings.js', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../app.js', import.meta.url), 'utf8');
const indexSource = await readFile(new URL('../index.html', import.meta.url), 'utf8');
assert.match(settingsSource, /gas-sync-protocol/);
assert.match(settingsSource, /安全モードでは受信もPOST/);
assert.match(appSource, /paramSyncProtocol/);
assert.match(indexSource, /value="secure-v2"/);

const gasSource = await readFile(new URL('../gas/Code.gs', import.meta.url), 'utf8');
assert.match(gasSource, /function doGet\(_event\)[\s\S]*method_not_allowed/);
assert.match(gasSource, /PropertiesService\.getScriptProperties\(\)/);
assert.match(gasSource, /function constantTimeEquals_/);
assert.match(gasSource, /LockService\.getScriptLock\(\)/);
assert.match(gasSource, /Utilities\.DigestAlgorithm\.SHA_256/);

console.log('P10 sync security tests passed');
