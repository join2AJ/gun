#!/usr/bin/env bash
# Roll the code back to an earlier release WITHOUT rewriting history:
# creates a new commit whose files equal the given tag (CHANGELOG.md and
# version.json are kept, because a rollback is itself a change you must record
# and the Play versionCode must still go up).
# Usage: scripts/rollback.sh v1.0.0
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
TAG="${1:?usage: scripts/rollback.sh <tag>   (see: git tag -l)}"
if ! git rev-parse -q --verify "$TAG^{commit}" >/dev/null; then
  # no tag yet (e.g. not created on this machine): find the commit in CHANGELOG.md
  V="${TAG#v}"; H=$(grep -E "^## \[$V\].*\`[0-9a-f]{7,40}\`" CHANGELOG.md | sed -E 's/.*`([0-9a-f]+)`.*/\1/' | head -1)
  [ -n "$H" ] && git rev-parse -q --verify "$H^{commit}" >/dev/null || { echo "No tag or CHANGELOG commit for $TAG"; git tag -l; exit 1; }
  echo "Using commit $H for $TAG (from CHANGELOG.md)"; TAG="$H"
fi
[ -z "$(git status --porcelain)" ] || { echo "Working tree not clean — commit or stash first."; exit 1; }

KEEP="CHANGELOG.md version.json"
git diff --name-only --diff-filter=A "$TAG" HEAD | grep -vxF -e CHANGELOG.md -e version.json | xargs -r git rm -q --
git checkout "$TAG" -- $(git ls-tree -r --name-only "$TAG" | grep -vxF -e CHANGELOG.md -e version.json)
echo
echo "Files restored to $TAG (not committed yet). Next:"
echo "  1. Bump version.json (new version + higher versionCode)"
echo "  2. Add a CHANGELOG.md entry: '### Changed — Rolled back to $TAG because …'"
echo "  3. git commit -am \"Roll back to $TAG\" && git tag vX.Y.Z && git push --follow-tags"
