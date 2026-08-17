import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    GAS_SYNC_PROTOCOLS,
    listCloudRecoveries,
    restoreCloudRecovery
} from '../sync-service.js';

const secureTeam = {
    gasApiUrl: 'https://example.test/secure-gas',
    gasSheetName: 'test',
    gasAuthToken: 'long-enough-token-for-a-secure-test',
    gasSyncProtocol: GAS_SYNC_PROTOCOLS.SECURE
};

const listCalls = [];
const recoveries = await listCloudRecoveries({
    teamInfo: secureTeam,
    fetchImpl: async (url, options) => {
        listCalls.push({ url, options });
        return { ok: true, status: 200, json: async () => ({ status: 'success', recoveries: [{ revision: 4, source: 'immediate' }] }) };
    }
});
assert.deepEqual(recoveries, [{ revision: 4, source: 'immediate' }]);
assert.equal(listCalls[0].options.method, 'POST');
assert.deepEqual(JSON.parse(listCalls[0].options.body), {
    action: 'listRecoveries', sheetName: 'test', authToken: 'long-enough-token-for-a-secure-test'
});

const restoreCalls = [];
await restoreCloudRecovery({
    teamInfo: secureTeam,
    revision: 4,
    expectedRevision: 6,
    fetchImpl: async (url, options) => {
        restoreCalls.push({ url, options });
        return { ok: true, status: 200, json: async () => ({ status: 'success', meta: { revision: 7 } }) };
    }
});
assert.deepEqual(JSON.parse(restoreCalls[0].options.body), {
    action: 'restore', revision: 4, expectedRevision: 6, force: false,
    sheetName: 'test', authToken: 'long-enough-token-for-a-secure-test'
});

await assert.rejects(
    () => listCloudRecoveries({ teamInfo: { ...secureTeam, gasSyncProtocol: GAS_SYNC_PROTOCOLS.LEGACY } }),
    error => error.kind === 'configuration'
);

const gas = await readFile(new URL('../gas/Code.gs', import.meta.url), 'utf8');
const settings = await readFile(new URL('../settings.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../app.js', import.meta.url), 'utf8');
assert.match(gas, /FORMAT_V2: 'coachmgr-secure-snapshot-v2'/);
assert.match(gas, /writeSnapshotAtomically_/);
assert.match(gas, /ensurePayloadGrid_/);
assert.match(gas, /listRecoveryGenerations_/);
assert.match(gas, /function restoreSnapshot_/);
assert.match(gas, /revision_conflict/);
assert.doesNotMatch(gas, /sheet\.clearContents\(\)/);
assert.match(settings, /btn-refresh-cloud-recoveries/);
assert.match(settings, /restoreCloudRecovery\(revision\)/);
assert.match(app, /export async function restoreCloudRecovery/);

console.log('P16 cloud recovery tests passed');
