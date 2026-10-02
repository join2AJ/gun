#!/usr/bin/env bash
# Creates any missing release tags vX.Y.Z:
#   - for every CHANGELOG heading that names a commit:  ## [1.0.0] — … · `06602bb`
#   - for the current version.json version, on HEAD
# Prints the tags it created. Push them with: git push origin --tags
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
made=()
while IFS='|' read -r ver hash; do
  git rev-parse -q --verify "refs/tags/v$ver" >/dev/null && continue
  git rev-parse -q --verify "$hash^{commit}" >/dev/null || { echo "skip v$ver: commit $hash not found"; continue; }
  git tag -a "v$ver" "$hash" -m "Calibre $ver"; made+=("v$ver")
done < <(grep -E '^## \[[0-9]+\.[0-9]+\.[0-9]+\].*`[0-9a-f]{7,40}`' CHANGELOG.md | sed -E 's/^## \[([^]]+)\].*`([0-9a-f]+)`.*/\1|\2/')
CUR=$(python3 -c "import json;print(json.load(open('version.json'))['version'])")
if ! git rev-parse -q --verify "refs/tags/v$CUR" >/dev/null; then git tag -a "v$CUR" HEAD -m "Calibre $CUR"; made+=("v$CUR"); fi
echo "created: ${made[*]:-none}"
