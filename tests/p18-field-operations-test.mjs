import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [html, source, app, css] = await Promise.all([
    readFile(new URL('../index.html', import.meta.url), 'utf8'),
    readFile(new URL('../matches.js', import.meta.url), 'utf8'),
    readFile(new URL('../app.js', import.meta.url), 'utf8'),
    readFile(new URL('../CSS/components.css', import.meta.url), 'utf8')
]);

for (const removedMarker of [
    'field-companion',
    'field-live-score',
    'field-event-filter',
    'btn-field-score',
    'btn-field-substitution',
    'modal-field-quick-action',
    'field-matchday-readiness'
]) {
    assert.doesNotMatch(html, new RegExp(removedMarker));
}

for (const removedMarker of [
    'recordFieldSubstitution',
    'recordFieldPositionChange',
    'renderFieldQuickAction',
    'releaseFieldCompanionSession'
]) {
    assert.doesNotMatch(source, new RegExp(removedMarker));
}
assert.doesNotMatch(app, /releaseFieldCompanionSession/);
assert.doesNotMatch(css, /field-companion|field-event-list|field-action-bar/);

assert.match(source, /let substitutionDraft = Array\.isArray\(period\.substitutions\)/);
assert.match(source, /このピリオドの交代選手/);
assert.match(source, /OUT選手とIN選手を選択してください/);
assert.match(source, /同じ選手をOUTとINにできません/);
assert.match(source, /period\.substitutions = finalData\.substitutions/);
assert.match(source, /c-data-list__item/);
assert.match(source, /u-visually-hidden/);

console.log('P18 period substitution records and removed field companion tests passed');
