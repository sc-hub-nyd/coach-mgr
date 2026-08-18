#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/reports/u-ext-usage-by-file.tsv"
mkdir -p "$ROOT/reports"

# Runtime source only: CSS definitions, tests, documentation, generated browser artifacts,
# and release-note text are excluded so a selector is never counted by a prefix match.
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

{
  printf 'selector\treference_count\tfiles\n'
  while IFS= read -r selector; do
    class_name="${selector#.}"
    exact_pattern="(^|[^[:alnum:]_-])${class_name}([^[:alnum:]_-]|$)"
    file_list=$("${RUNTIME_GREP[@]}" -l -E "$exact_pattern" "$ROOT" 2>/dev/null || true)
    reference_count=$( ("${RUNTIME_GREP[@]}" -h -o -E "$exact_pattern" "$ROOT" 2>/dev/null || true) | wc -l | tr -d ' ')
    files=$(printf '%s\n' "$file_list" | sed "s#^$ROOT/##" | paste -sd ',' -)
    printf '%s\t%s\t%s\n' "$selector" "$reference_count" "$files"
  done < <(grep -h -o -E '^\.u-ext-[0-9]+' "$ROOT/CSS/components.css" | sort -u)
} > "$OUT"

awk -F'\t' 'NR == 1 { print; next } { split($3, files, ","); for (i in files) if (files[i] != "") { count[files[i]]++; refs[files[i]] += $2 } } END { for (file in count) printf "summary\t%s\tselectors=%d references=%d\n", file, count[file], refs[file] }' "$OUT" | sort -k2,2
