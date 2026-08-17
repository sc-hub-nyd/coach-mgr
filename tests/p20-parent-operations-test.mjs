import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
    ensureParentShareSettings,
    rotateParentShareLink,
    isParentShareValid,
    getRsvpDeadlineStatus,
    buildRsvpReminderText,
    buildPendingRsvpDigest
} from '../parent-operations-service.js';

const teamInfo = {};
const firstShare = ensureParentShareSettings(teamInfo);
const firstToken = firstShare.token;
assert.equal(firstShare.version, 1);
assert.ok(firstToken);
assert.equal(isParentShareValid(teamInfo, { version: 1, token: firstToken }), true);
const rotated = rotateParentShareLink(teamInfo, { expiresAt: '2026-08-20' });
assert.equal(rotated.version, 2);
assert.notEqual(rotated.token, firstToken);
assert.equal(isParentShareValid(teamInfo, { version: 1, token: firstToken }), false);
assert.equal(isParentShareValid(teamInfo, { version: 2, token: rotated.token, now: new Date('2026-08-19T10:00:00') }), true);
assert.equal(isParentShareValid(teamInfo, { version: 2, token: rotated.token, now: new Date('2026-08-21T10:00:00') }), false);

const event = {
    date: '2026-08-25', opponent: 'FCテスト', rsvpDeadline: '2026-08-20', callUpPlayerIds: [1, 2, 3],
    attendanceByPlayer: { '1': { status: 'attending' }, '2': { status: 'pending' }, '3': { status: 'pending' } }
};
const status = getRsvpDeadlineStatus(event, { now: new Date('2026-08-21T09:00:00') });
assert.equal(status.status, 'overdue');
assert.equal(status.pending, 2);
const reminder = buildRsvpReminderText(event, [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }], '試合');
assert.match(reminder, /回答期限：2026-08-20/);
assert.match(reminder, /対象：B、C/);
const digest = buildPendingRsvpDigest([event], [{ id: 2, name: 'B' }], new Date('2026-08-21T09:00:00'));
assert.equal(digest.pendingEvents.length, 1);
assert.match(digest.text, /期限超過/);

const [html, settings, app, matches, practices, teamService, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../settings.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../matches.js', import.meta.url), 'utf8'),
    readFile(new URL('../practices.js', import.meta.url), 'utf8'),
    readFile(new URL('../team-operations-service.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);
assert.match(html, /match-rsvp-deadline/);
assert.match(html, /practice-rsvp-deadline/);
assert.match(html, /btn-copy-parent-share-link/);
assert.match(html, /btn-copy-rsvp-reminder/);
assert.match(settings, /rotateParentShareLink/);
assert.match(settings, /buildPendingRsvpDigest/);
assert.match(app, /parentShareVersion/);
assert.match(app, /isParentShareValid/);
assert.match(matches, /rsvpDeadline/);
assert.match(practices, /rsvpDeadline/);
assert.match(teamService, /回答期限/);
assert.match(css, /parent-share-body/);
console.log('P20 parent operations tests passed');
