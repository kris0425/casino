#!/usr/bin/env bash
set -Eeuo pipefail

: "${ORACLE_SSH_KEY:?請設定 GitHub Secret ORACLE_SSH_KEY}"
: "${ORACLE_HOST:?請設定 GitHub Secret ORACLE_HOST，例如 ubuntu@161.33.185.80}"
: "${ORACLE_KNOWN_HOSTS:?請設定 GitHub Secret ORACLE_KNOWN_HOSTS}"

ORACLE_PROJECT="${ORACLE_PROJECT:-/home/ubuntu/discord-casino-bot}"
INITIAL_BASE_COMMIT="${INITIAL_BASE_COMMIT:-072e24eee51c6faf1e01e7b5660896c9aa40c590}"
UPDATE_FILE="${UPDATE_FILE:-}"

[[ "$ORACLE_PROJECT" == "/home/ubuntu/discord-casino-bot" ]] || { echo "unsafe Oracle project path" >&2; exit 2; }
HEAD_COMMIT="$(git rev-parse HEAD)"
SHORT_COMMIT="${HEAD_COMMIT:0:7}"
TMP_ROOT="${RUNNER_TEMP:-/tmp}/casino-deploy-${SHORT_COMMIT}-${RANDOM}"
TEMP_KEY="$TMP_ROOT/oracle.key"
KNOWN_HOSTS="$TMP_ROOT/known_hosts"
BUNDLE="$TMP_ROOT/changes.tar"
COPY_LIST="$TMP_ROOT/copy-files.txt"
DELETE_LIST="$TMP_ROOT/delete-files.txt"
REMOTE_STAGE="/home/ubuntu/release-staging/$SHORT_COMMIT"

cleanup() { rm -rf -- "$TMP_ROOT"; }
trap cleanup EXIT
mkdir -p "$TMP_ROOT"
printf '%s\n' "$ORACLE_SSH_KEY" > "$TEMP_KEY"
chmod 600 "$TEMP_KEY"
printf '%s\n' "$ORACLE_KNOWN_HOSTS" > "$KNOWN_HOSTS"
chmod 600 "$KNOWN_HOSTS"

SSH_OPTS=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -i "$TEMP_KEY")
SCP_OPTS=(-q -o BatchMode=yes -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$KNOWN_HOSTS" -i "$TEMP_KEY")
ssh_remote() { ssh "${SSH_OPTS[@]}" "$ORACLE_HOST" "$1"; }

is_deploy_path() {
  case "$1" in
    .dockerignore|.gitattributes|Dockerfile|docker-compose.yml|package.json|package-lock.json|CHANGELOG.md) return 0 ;;
    src/*|assets/*|activity/public/*|scripts/*|updates/*|tests/*) return 0 ;;
    *) return 1 ;;
  esac
}

BASE_COMMIT="$(ssh_remote "cat '$ORACLE_PROJECT/.deployed_commit' 2>/dev/null || true" | tr -d '\r\n')"
BASE_COMMIT="${BASE_COMMIT:-$INITIAL_BASE_COMMIT}"
[[ "$BASE_COMMIT" =~ ^[0-9a-f]{7,40}$ ]] || { echo "invalid Oracle base commit" >&2; exit 2; }
git cat-file -e "${BASE_COMMIT}^{commit}"
git merge-base --is-ancestor "$BASE_COMMIT" "$HEAD_COMMIT"

declare -A COPY_SET=()
declare -A DELETE_SET=()
add_copy() { is_deploy_path "$1" && COPY_SET["$1"]=1; }
add_delete() { is_deploy_path "$1" && DELETE_SET["$1"]=1; }

while IFS= read -r path; do [[ -n "$path" ]] && add_copy "$path"; done < <(git diff --name-only --diff-filter=ACMRT "$BASE_COMMIT..$HEAD_COMMIT")
while IFS= read -r path; do [[ -n "$path" ]] && add_delete "$path"; done < <(git diff --name-only --diff-filter=D "$BASE_COMMIT..$HEAD_COMMIT")
for required in scripts/deploy_oracle.ps1 scripts/deploy_oracle_remote.sh scripts/backup_sqlite.mjs tests/achievements.test.js; do add_copy "$required"; done

if [[ -z "$UPDATE_FILE" ]]; then
  while IFS= read -r path; do
    [[ "$path" == updates/*.json ]] && UPDATE_FILE="$path"
  done < <(printf '%s\n' "${!COPY_SET[@]}" | sort)
fi
if [[ -n "$UPDATE_FILE" ]]; then
  [[ "$UPDATE_FILE" =~ ^updates/[A-Za-z0-9._/-]+\.json$ ]] || { echo "invalid update file path" >&2; exit 2; }
  add_copy "$UPDATE_FILE"
fi

mapfile -t COPY_PATHS < <(printf '%s\n' "${!COPY_SET[@]}" | sort)
mapfile -t DELETE_PATHS < <(printf '%s\n' "${!DELETE_SET[@]}" | sort)
for relative in "${COPY_PATHS[@]}"; do [[ -f "$relative" ]] || { echo "missing deployment file: $relative" >&2; exit 2; }; done
printf '%s\n' "${COPY_PATHS[@]}" > "$COPY_LIST"
printf '%s\n' "${DELETE_PATHS[@]}" > "$DELETE_LIST"

tar -cf "$BUNDLE" -T "$COPY_LIST"
ssh_remote "mkdir -p '$REMOTE_STAGE/source' '/home/ubuntu/release-backups/$SHORT_COMMIT'"
scp "${SCP_OPTS[@]}" "$BUNDLE" "$ORACLE_HOST:$REMOTE_STAGE/changes.tar"
scp "${SCP_OPTS[@]}" "$DELETE_LIST" "$ORACLE_HOST:$REMOTE_STAGE/delete-files.txt"
ssh_remote "tar -xf '$REMOTE_STAGE/changes.tar' -C '$REMOTE_STAGE/source'"
ssh_remote "sed -i 's/\r$//' '$REMOTE_STAGE/source/scripts/deploy_oracle_remote.sh'"

UPDATE_ARGUMENT="${UPDATE_FILE:--}"
ssh_remote "bash '$REMOTE_STAGE/source/scripts/deploy_oracle_remote.sh' '$ORACLE_PROJECT' '$REMOTE_STAGE' '$SHORT_COMMIT' '$HEAD_COMMIT' '$UPDATE_ARGUMENT'"
echo "GITHUB_ACTIONS_DEPLOY_OK commit=$HEAD_COMMIT"
