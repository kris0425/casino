#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="${1:?project path required}"
STAGE="${2:?staging path required}"
SHORT_COMMIT="${3:?short commit required}"
FULL_COMMIT="${4:?full commit required}"
UPDATE_FILE="${5:--}"
CONTAINER="discord-casino"
IMAGE="discord-casino-bot-discord-casino"

PROJECT="$(realpath -m "$PROJECT")"
STAGE="$(realpath -m "$STAGE")"
EXPECTED_PROJECT="/home/ubuntu/discord-casino-bot"
EXPECTED_STAGE="/home/ubuntu/release-staging/$SHORT_COMMIT"
BACKUP_DIR="/home/ubuntu/release-backups/$SHORT_COMMIT"

[[ "$PROJECT" == "$EXPECTED_PROJECT" ]] || { echo "unsafe project path: $PROJECT" >&2; exit 2; }
[[ "$STAGE" == "$EXPECTED_STAGE" ]] || { echo "unsafe staging path: $STAGE" >&2; exit 2; }
[[ "$SHORT_COMMIT" =~ ^[0-9a-f]{7}$ ]] || { echo "invalid short commit" >&2; exit 2; }
[[ "$FULL_COMMIT" =~ ^[0-9a-f]{40}$ ]] || { echo "invalid full commit" >&2; exit 2; }
[[ -d "$STAGE/source" && -f "$STAGE/delete-files.txt" ]] || { echo "incomplete staging payload" >&2; exit 2; }

is_deploy_path() {
  case "$1" in
    .dockerignore|Dockerfile|docker-compose.yml|package.json|package-lock.json|CHANGELOG.md) return 0 ;;
    src/*|assets/*|activity/public/*|scripts/*|updates/*|tests/*) return 0 ;;
    *) return 1 ;;
  esac
}

mkdir -p "$BACKUP_DIR"
if [[ ! -s "$BACKUP_DIR/casino.sqlite" ]]; then
  rm -f -- "$BACKUP_DIR/casino.sqlite"
  sudo docker run --rm \
    -v "$PROJECT:/work" \
    -v "$STAGE/source:/stage:ro" \
    -v "$BACKUP_DIR:/backup" \
    "$IMAGE" node /stage/scripts/backup_sqlite.mjs /work/data/casino.sqlite /backup/casino.sqlite
else
  echo "BACKUP_REUSED $BACKUP_DIR/casino.sqlite"
fi
test -s "$BACKUP_DIR/casino.sqlite"
sudo docker image tag "$IMAGE:latest" "discord-casino-backup:pre-$SHORT_COMMIT"

tar -C "$STAGE/source" -cf - . | tar -C "$PROJECT" -xf -
while IFS= read -r relative || [[ -n "$relative" ]]; do
  [[ -z "$relative" ]] && continue
  [[ "$relative" != /* && ! "$relative" =~ (^|/)\.\.(/|$) ]] || { echo "unsafe deletion entry: $relative" >&2; exit 2; }
  is_deploy_path "$relative" || { echo "refusing non-deploy deletion: $relative" >&2; exit 2; }
  target="$(realpath -m "$PROJECT/$relative")"
  [[ "$target" == "$PROJECT/"* ]] || { echo "deletion escaped project: $target" >&2; exit 2; }
  rm -f -- "$target"
done < "$STAGE/delete-files.txt"

cd "$PROJECT"
sudo DOCKER_BUILDKIT=1 docker compose build "$CONTAINER"
sudo docker run --rm -v "$PROJECT/tests:/app/tests:ro" "$IMAGE" npm test
sudo docker run --rm --env-file .env -e COMMAND_BUILD_ONLY=1 "$IMAGE"
sudo docker compose up -d --no-deps "$CONTAINER"

logged_in=false
for _ in $(seq 1 12); do
  if sudo docker logs --since 2m "$CONTAINER" 2>&1 | grep -Fq '已登入：'; then
    logged_in=true
    break
  fi
  sleep 5
done
[[ "$logged_in" == true ]] || { echo "Discord login was not confirmed" >&2; sudo docker logs --tail 120 "$CONTAINER" >&2; exit 1; }

running_image="$(sudo docker inspect -f '{{.Image}}' "$CONTAINER")"
expected_image="$(sudo docker image inspect -f '{{.Id}}' "$IMAGE")"
[[ "$running_image" == "$expected_image" ]] || { echo "running image mismatch" >&2; exit 1; }

if [[ "$UPDATE_FILE" != '-' ]]; then
  [[ "$UPDATE_FILE" =~ ^updates/[A-Za-z0-9._/-]+\.json$ && -f "$PROJECT/$UPDATE_FILE" ]] || { echo "invalid update file: $UPDATE_FILE" >&2; exit 2; }
  sudo docker exec "$CONTAINER" node scripts/publish_update.js "$UPDATE_FILE"
fi

printf '%s\n' "$FULL_COMMIT" > "$PROJECT/.deployed_commit.tmp"
mv -f "$PROJECT/.deployed_commit.tmp" "$PROJECT/.deployed_commit"
sudo docker ps --filter "name=^/$CONTAINER$"
sudo docker logs --since 2m --tail 80 "$CONTAINER" 2>&1

resolved_stage="$(realpath -m "$STAGE")"
[[ "$resolved_stage" == "$EXPECTED_STAGE" ]] || { echo "unsafe staging cleanup path" >&2; exit 2; }
rm -rf -- "$resolved_stage"
echo "ORACLE_DEPLOY_OK commit=$FULL_COMMIT backup=$BACKUP_DIR/casino.sqlite rollback=discord-casino-backup:pre-$SHORT_COMMIT"
