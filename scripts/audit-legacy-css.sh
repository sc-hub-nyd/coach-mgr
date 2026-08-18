#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/reports/legacy-css-audit.tsv"
mkdir -p "$ROOT/reports"

{
  printf 'category\tselector\tcss_definitions\tnon_css_references\n'
  while IFS= read -r selector; do
    class_name="${selector#.}"
    css_defs=$( (grep -R --include='*.css' -h -o -E "\\${selector}([[:space:]:.{#>]|$)" "$ROOT/CSS" 2>/dev/null || true) | wc -l | tr -d ' ')
    refs=$( (grep -R --exclude-dir='.git' --exclude='*.css' --exclude='legacy-css-audit.tsv' -h -o -F "$class_name" "$ROOT" 2>/dev/null || true) | wc -l | tr -d ' ')
    printf 'u-ext\t%s\t%s\t%s\n' "$selector" "$css_defs" "$refs"
  done < <(grep -h -o -E '\.u-ext-[0-9]+' "$ROOT/CSS/components.css" | sort -u)

  for selector in '.attendance-roster-row' '.timeline-edit-row' '.pk-kicker-row' '.field-roster-chip' '.field-event-item' '.filmstrip-card'; do
    class_name="${selector#.}"
    css_defs=$( (grep -R --include='*.css' -h -o -E "\\${selector}([[:space:]:.{#>]|$)" "$ROOT/CSS" 2>/dev/null || true) | wc -l | tr -d ' ')
    refs=$( (grep -R --exclude-dir='.git' --exclude='*.css' --exclude='legacy-css-audit.tsv' -h -o -F "$class_name" "$ROOT" 2>/dev/null || true) | wc -l | tr -d ' ')
    printf 'legacy-component\t%s\t%s\t%s\n' "$selector" "$css_defs" "$refs"
  done
} > "$OUT"

awk -F'\t' 'NR == 1 || ($3 > 0 && $4 == 0)' "$OUT"
