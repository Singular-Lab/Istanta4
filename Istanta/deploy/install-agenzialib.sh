#!/usr/bin/env bash
# Run on the Linux Docker host, after verifying the release manifest/run.
# Usage: bash install-agenzialib.sh DLL EXPECTED_SHA256 /srv/istanta/external_lib
set -euo pipefail
if (( $# != 3 )); then
  echo 'Usage: install-agenzialib.sh DLL EXPECTED_SHA256 EXISTING_PLUGIN_DIRECTORY' >&2
  exit 2
fi
payload=$1
expected=${2,,}
destination=$(realpath -e -- "$3")
[[ -f "$payload" && -d "$destination" && "$expected" =~ ^[a-f0-9]{64}$ ]] || exit 2
# Serialize installers targeting the same directory; the application only reads.
exec 9>"$destination/.agenzialib-install.lock"
flock -x 9
staged=$(mktemp "$destination/.AgenziaLib.dll.XXXXXX")
trap 'rm -f -- "$staged"' EXIT
cp -- "$payload" "$staged"
actual=$(sha256sum -- "$staged")
actual=${actual%% *}
if [[ "$actual" != "$expected" ]]; then
  echo 'Checksum mismatch: current DLL has not been changed.' >&2
  exit 1
fi
chmod 0644 "$staged"
if [[ -f "$destination/AgenziaLib.dll" ]]; then
  mkdir -p -- "$destination/.history"
  previous=$(sha256sum -- "$destination/AgenziaLib.dll")
  previous=${previous%% *}
  cp -- "$destination/AgenziaLib.dll" "$destination/.history/$previous.dll"
fi
# Same-directory rename: readers see the complete old file or the complete new one.
mv -fT -- "$staged" "$destination/AgenziaLib.dll"
printf 'Installed AgenziaLib.dll sha256:%s\n' "$actual"
