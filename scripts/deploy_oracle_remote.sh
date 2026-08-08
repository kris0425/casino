#!/usr/bin/env bash
set -Eeuo pipefail

PROJECT="${1:?project path required}"
STAGE="${2:?staging path required}"
SHORT_COMMIT="${3:?short commit required}"
FULL_COMMIT="${4:?full commit required}"
UPDATE_FILE="${5:--}"
CONTAINER="discord-casino"
IMAGE="discord-casino-bot-discord-casino"
ACTIVITY_TUNNEL_CONTAINER="casino-activity-api-tunnel"

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
    .dockerignore|.gitattributes|Dockerfile|docker-compose.yml|package.json|package-lock.json|CHANGELOG.md) return 0 ;;
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
requires_image_build_path() {
  case "$1" in
    .dockerignore|Dockerfile|docker-compose.yml|package.json|package-lock.json|src/*) return 0 ;;
    assets/*|activity/public/*|scripts/*|updates/*|tests/*|CHANGELOG.md|.gitattributes) return 1 ;;
    *) return 0 ;;
  esac
}

# A Cloudflare Quick Tunnel gets a new public hostname whenever its container is
# recreated. Keep the Discord links in .env aligned with the currently running
# tunnel before the bot is restarted. Only the public URL is changed; secrets
# stay untouched.
sync_activity_public_url() {
  local tunnel_url current_url
  tunnel_url="$(sudo docker logs --tail 500 "$ACTIVITY_TUNNEL_CONTAINER" 2>&1 \
    | sed -nE 's#.*(https://[a-z0-9-]+\.trycloudflare\.com).*#\1#p' \
    | tail -n 1)"
  if [[ -z "$tunnel_url" ]]; then
    echo "ACTIVITY_PUBLIC_URL_SYNC_SKIPPED no active Quick Tunnel URL found" >&2
    return 0
  fi
  [[ "$tunnel_url" =~ ^https://[a-z0-9-]+\.trycloudflare\.com$ ]] || {
    echo "invalid Quick Tunnel URL" >&2
    return 1
  }
  current_url="$(sed -nE 's/^ACTIVITY_PUBLIC_URL=(.*)$/\1/p' .env | tail -n 1)"
  if [[ "$current_url" == "$tunnel_url" ]]; then
    echo "ACTIVITY_PUBLIC_URL_SYNC_OK unchanged"
    return 0
  fi
  if grep -q '^ACTIVITY_PUBLIC_URL=' .env; then
    sed -i -E "s#^ACTIVITY_PUBLIC_URL=.*#ACTIVITY_PUBLIC_URL=$tunnel_url#" .env
  else
    printf '\nACTIVITY_PUBLIC_URL=%s\n' "$tunnel_url" >> .env
  fi
  echo "ACTIVITY_PUBLIC_URL_SYNC_OK updated=$tunnel_url"
}

IMAGE_BUILD_REQUIRED=false
while IFS= read -r relative; do
  [[ -z "$relative" ]] && continue
  if requires_image_build_path "$relative"; then
    IMAGE_BUILD_REQUIRED=true
    break
  fi
done < <(find "$STAGE/source" -type f -printf '%P\n')
if [[ "$IMAGE_BUILD_REQUIRED" != true ]]; then
  while IFS= read -r relative || [[ -n "$relative" ]]; do
    [[ -z "$relative" ]] && continue
    if requires_image_build_path "$relative"; then
      IMAGE_BUILD_REQUIRED=true
      break
    fi
  done < "$STAGE/delete-files.txt"
fi

if [[ "$IMAGE_BUILD_REQUIRED" == true ]]; then
  echo "IMAGE_BUILD_REQUIRED source-or-dependency changes detected"
  sudo DOCKER_BUILDKIT=1 docker compose build "$CONTAINER"
else
  echo "IMAGE_BUILD_SKIPPED runtime-mounted files only"
fi

sync_activity_public_url

RUNTIME_MOUNTS=(
  -v "$PROJECT/.dockerignore:/app/.dockerignore:ro"
  -v "$PROJECT/Dockerfile:/app/Dockerfile:ro"
  -v "$PROJECT/docker-compose.yml:/app/docker-compose.yml:ro"
  -v "$PROJECT/src:/app/src:ro"
  -v "$PROJECT/assets:/app/assets:ro"
  -v "$PROJECT/activity/public:/app/activity/public:ro"
  -v "$PROJECT/scripts:/app/scripts:ro"
  -v "$PROJECT/updates:/app/updates:ro"
)
sudo docker run --rm -v "$PROJECT/tests:/app/tests:ro" "${RUNTIME_MOUNTS[@]}" "$IMAGE" npm test
sudo docker run --rm --env-file .env -e COMMAND_BUILD_ONLY=1 "${RUNTIME_MOUNTS[@]}" "$IMAGE"
sudo docker compose up -d --no-deps --force-recreate "$CONTAINER"

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
