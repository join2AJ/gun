#!/usr/bin/env bash
# Fails if code changed without a CHANGELOG entry, or if version.json and
# CHANGELOG.md disagree. Usage: scripts/check-changelog.sh [BASE_REF]  (default: HEAD~1)
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BASE="${1:-HEAD~1}"
fail() { echo "✗ $*" >&2; exit 1; }

VERSION=$(python3 -c "import json;print(json.load(open('version.json'))['version'])")
CODE=$(python3 -c "import json;print(json.load(open('version.json'))['versionCode'])")
grep -q "^## \[$VERSION\]" CHANGELOG.md || fail "version.json is $VERSION but CHANGELOG.md has no '## [$VERSION]' section."

if git rev-parse -q --verify "$BASE^{commit}" >/dev/null; then
  CHANGED=$(git diff --name-only "$BASE" HEAD)
  # files that don't need a changelog entry on their own
  CODE_CHANGES=$(echo "$CHANGED" | grep -vE '^(CHANGELOG\.md|README\.md|CLAUDE\.md|docs/|store/LISTING\.md|\.gitignore)' || true)
  if [ -n "$CODE_CHANGES" ] && ! echo "$CHANGED" | grep -qx 'CHANGELOG.md'; then
    echo "Changed files:"; echo "$CODE_CHANGES" | sed 's/^/  /'
    fail "Code changed but CHANGELOG.md was not updated. Add an entry under [Unreleased] or a new version."
  fi
  if echo "$CHANGED" | grep -qx 'version.json' && git cat-file -e "$BASE:version.json" 2>/dev/null; then
    OLD=$(git show "$BASE:version.json" | python3 -c "import json,sys;print(json.load(sys.stdin)['versionCode'])")
    [ "$CODE" -gt "$OLD" ] || fail "versionCode must increase (was $OLD, now $CODE)."
  fi
fi
echo "✓ CHANGELOG and version.json are consistent (v$VERSION, build $CODE)."
