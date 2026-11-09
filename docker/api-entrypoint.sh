#!/bin/sh
set -eu

# Call the prisma/ts-node binaries directly rather than via `pnpm exec` —
# the runtime image is deliberately NOT a full pnpm workspace (no root
# pnpm-workspace.yaml/package.json, no sibling apps/packages source), so
# `pnpm exec` fails its workspace-consistency check
# (ERR_PNPM_WORKSPACE_PKG_NOT_FOUND) even though everything the commands
# below actually need is already present in ./node_modules.
if [ "${MIGRATE_DATABASE:-false}" = "true" ]; then
  ./node_modules/.bin/prisma migrate deploy
fi

if [ "${SEED_DATABASE:-false}" = "true" ]; then
  ./node_modules/.bin/prisma db seed
fi

exec node dist/main.js
