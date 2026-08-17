import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createParentAccessInvite, getParentAccessInvite, getParentAccessSummary, revokeParentAccessInvite } from '../parent-operations-service.js';

const teamInfo = {};
const invite = createParentAccessInvite(teamInfo, { playerId: 12, label: '山田様', scopes: ['schedule', 'development'], expiresAt: '2026-12-31' });
assert.equal(invite.playerId, '12');
assert.deepEqual(invite.scopes, ['schedule', 'development']);
assert.equal(getParentAccessInvite(teamInfo, { inviteId: invite.id, token: invite.token, now: new Date('2026-08-18') }).label, '山田様');
assert.equal(getParentAccessInvite(teamInfo, { inviteId: invite.id, token: 'wrong' }), null);
const expired = createParentAccessInvite(teamInfo, { playerId: 13, expiresAt: '2026-01-01' });
assert.equal(getParentAccessInvite(teamInfo, { inviteId: expired.id, token: expired.token, now: new Date('2026-08-18') }), null);
assert.equal(getParentAccessSummary(teamInfo).active.length, 1);
revokeParentAccessInvite(teamInfo, invite.id);
assert.equal(getParentAccessInvite(teamInfo, { inviteId: invite.id, token: invite.token }), null);
assert.equal(getParentAccessSummary(teamInfo).revoked.length, 1);

const [html, settings, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../settings.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
assert.match(html, /btn-create-parent-access/);
assert.match(html, /parent-access-scopes/);
assert.match(settings, /createParentAccessInvite/);
assert.match(settings, /revokeParentAccessInvite/);
assert.match(app, /parentInviteId/);
assert.match(app, /coachMgrParentAccessScopes/);
assert.match(app, /getParentAccessScopes/);
assert.match(css, /parent-access-manager/);
console.log('P26 parent access tests passed');
