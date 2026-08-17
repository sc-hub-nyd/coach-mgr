import assert from 'node:assert/strict';
import { ensureAttendance, setAttendanceStatus, getAttendanceSummary, createPracticeTemplate, applyPracticeTemplate, buildEventShareText } from '../team-operations-service.js';
import { createStateSnapshot, parseBackupPayload } from '../repository.js';

const practice = {
    id: 101,
    date: '2026-08-18',
    location: '市民スポーツセンター',
    menus: [{ id: 1, focus: 'パス＆コントロール', frames: [{ objects: [] }] }],
    presentPlayerIds: [1]
};
ensureAttendance(practice, [1, 2, 3]);
assert.deepEqual(practice.callUpPlayerIds, [1, 2, 3]);
assert.equal(practice.attendanceByPlayer['1'].status, 'attending');
assert.equal(practice.attendanceByPlayer['2'].status, 'pending');
setAttendanceStatus(practice, 2, 'absent', 'parent', new Date('2026-08-17T00:00:00.000Z'));
setAttendanceStatus(practice, 3, 'attending', 'coach', new Date('2026-08-17T00:01:00.000Z'));
assert.deepEqual(practice.presentPlayerIds, [1, 3]);
assert.deepEqual(getAttendanceSummary(practice), { attending: 2, absent: 1, pending: 0, total: 3 });

const template = createPracticeTemplate(practice, '基礎技術テンプレート');
assert.equal(template.name, '基礎技術テンプレート');
assert.notEqual(template.menus, practice.menus);
const newPractice = { id: 102, date: '2026-08-20', location: '', menus: [] };
applyPracticeTemplate(newPractice, template);
assert.equal(newPractice.location, '市民スポーツセンター');
assert.equal(newPractice.menus[0].focus, 'パス＆コントロール');
newPractice.menus[0].focus = '変更済み';
assert.equal(template.menus[0].focus, 'パス＆コントロール');

const shareText = buildEventShareText(practice, [
    { id: 1, name: '太郎' }, { id: 2, name: '花子' }, { id: 3, name: '次郎' }
], '練習');
assert.match(shareText, /参加 2名/);
assert.match(shareText, /欠席 1名/);
assert.match(shareText, /太郎、次郎/);

const snapshot = createStateSnapshot({ practices: [practice], practiceTemplates: [template] });
assert.equal(snapshot.practiceTemplates.length, 1);
assert.equal(snapshot.practices[0].attendanceByPlayer['2'].status, 'absent');
const restored = parseBackupPayload(snapshot);
assert.equal(restored.practiceTemplates[0].name, '基礎技術テンプレート');
assert.equal(restored.practices[0].attendance, '2/3');

console.log('P6 team operations tests passed');
