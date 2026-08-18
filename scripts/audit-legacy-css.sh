#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/reports/legacy-css-audit.tsv"
mkdir -p "$ROOT/reports"

# Only runtime sources are relevant for a safe static-use gate. Generated reports,
# tests, docs, and release-note text would otherwise retain a selector by mentioning it.
RUNTIME_GREP=(
  grep -R
  --include='*.js'
  --include='*.html'
  --exclude='version.js'
  --exclude-dir='.git'
  --exclude-dir='tests'
  --exclude-dir='reports'
  --exclude-dir='responsive-artifacts'
  --exclude-dir='terminal_full_output'
  --exclude-dir='liquid-ui-design-system-slides'
)

runtime_refs() {
  local class_name="$1"
  local exact_pattern="(^|[^[:alnum:]_-])${class_name}([^[:alnum:]_-]|$)"
  ("${RUNTIME_GREP[@]}" -h -o -E "$exact_pattern" "$ROOT" 2>/dev/null || true) | wc -l | tr -d ' '
}

{
  printf 'category\tselector\tcss_definitions\truntime_references\n'
  while IFS= read -r selector; do
    class_name="${selector#.}"
    css_defs=$( (grep -h -o -E "^\\${selector}([[:space:]:.{#>]|$)" "$ROOT/CSS/components.css" 2>/dev/null || true) | wc -l | tr -d ' ')
    refs=$(runtime_refs "$class_name")
    printf 'u-ext\t%s\t%s\t%s\n' "$selector" "$css_defs" "$refs"
  done < <(grep -h -o -E '^\.u-ext-[0-9]+' "$ROOT/CSS/components.css" | sort -u)

  for selector in '.attendance-roster-row' '.timeline-edit-row' '.pk-kicker-row' '.field-roster-chip' '.field-event-item' '.filmstrip-card'; do
    class_name="${selector#.}"
    css_defs=$( (grep -R --include='*.css' -h -o -E "\\${selector}([[:space:]:.{#>]|$)" "$ROOT/CSS" 2>/dev/null || true) | wc -l | tr -d ' ')
    refs=$(runtime_refs "$class_name")
    printf 'legacy-component\t%s\t%s\t%s\n' "$selector" "$css_defs" "$refs"
  done
} > "$OUT"

awk -F'\t' 'NR == 1 || ($3 > 0 && $4 == 0)' "$OUT"
