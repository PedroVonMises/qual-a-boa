#!/usr/bin/env bash
# Vercel web build. vercel.json sets EXPO_PUBLIC_APP_ENV=production for every build.
# The preview of the branches listed in DEMO_PREVIEW_BRANCHES runs on mock data instead: bundled seed
# catalog, demo tools on, demo data loaded on first launch, Casas flow in demo mode (no backend calls).
set -euo pipefail
DEMO_PREVIEW_BRANCHES="claude/project-thread-mx7z8b"
if [ "${VERCEL_ENV:-}" = "preview" ] && [[ " $DEMO_PREVIEW_BRANCHES " == *" ${VERCEL_GIT_COMMIT_REF:-} "* ]]; then
  echo "vercel-build: demo preview for ${VERCEL_GIT_COMMIT_REF} (seed data, demo autoload)"
  export EXPO_PUBLIC_APP_ENV=preview EXPO_PUBLIC_DATA_SOURCE=seed EXPO_PUBLIC_DEMO_AUTOLOAD=1
fi
npx expo export --platform web
