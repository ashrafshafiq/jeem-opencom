#!/usr/bin/env bash
#
# One-shot bootstrap for the self-hosted Convex backend running in Docker Compose.
#
# Runs in the `convex-deploy` service after the backend is healthy and the admin key
# has been generated. It:
#   1. reads the admin key from the shared volume and points the Convex CLI at the
#      in-network backend (http://convex-backend:3210),
#   2. ensures Convex Auth env (JWT_PRIVATE_KEY / JWKS / SITE_URL) plus any optional
#      secrets are set on the deployment (idempotent — see setup-convex-env.mjs),
#   3. pushes the functions in packages/convex to the backend.
#
# It is safe to re-run: existing env vars are left untouched and `convex deploy` is
# incremental.
set -euo pipefail

ADMIN_KEY_FILE="${ADMIN_KEY_FILE:-/shared/admin_key}"

echo "==> Waiting for the generated admin key at ${ADMIN_KEY_FILE}"
for _ in $(seq 1 30); do
  if [ -s "${ADMIN_KEY_FILE}" ]; then
    break
  fi
  sleep 1
done

if [ ! -s "${ADMIN_KEY_FILE}" ]; then
  echo "ERROR: admin key was not written to ${ADMIN_KEY_FILE}." >&2
  echo "       Check the 'convex-admin-key' service logs (docker compose logs convex-admin-key)." >&2
  exit 1
fi

CONVEX_SELF_HOSTED_ADMIN_KEY="$(tr -d '[:space:]' < "${ADMIN_KEY_FILE}")"
export CONVEX_SELF_HOSTED_ADMIN_KEY
# CONVEX_SELF_HOSTED_URL is provided by compose; default here so the script also works standalone.
export CONVEX_SELF_HOSTED_URL="${CONVEX_SELF_HOSTED_URL:-http://convex-backend:3210}"

echo "==> Using self-hosted Convex at ${CONVEX_SELF_HOSTED_URL}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
cd "${ROOT_DIR}/packages/convex"

echo "==> Ensuring Convex Auth environment variables are set"
node "${SCRIPT_DIR}/setup-convex-env.mjs"

echo "==> Deploying Convex functions (packages/convex)"
pnpm exec convex deploy -y

echo "==> Convex backend is ready."
echo "    Web dashboard:     http://localhost:3000"
echo "    Convex dashboard:  http://localhost:6791"
