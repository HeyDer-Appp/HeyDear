#!/bin/sh

# Xcode Cloud only knows how to build the native Xcode project — it has no
# idea this app is a Capacitor wrapper around a Vite/React web app. Left
# alone, it would just archive whatever web build already happens to be
# committed under ios/App/App/public (stale, or missing entirely on a clean
# clone), never the code that was actually just pushed. This script runs
# right after Xcode Cloud clones the repo, before it opens the Xcode
# project, and does what `npm run build && npx cap sync ios` does locally:
# builds the current web app and copies it into the native project.
#
# Per Apple's Xcode Cloud contract, this file must live at
# ios/App/ci_scripts/ci_post_clone.sh (ci_scripts next to the .xcodeproj)
# and CI_PRIMARY_REPOSITORY_PATH is the repo root Xcode Cloud checked out.

set -e

echo "== HeyDer: building the web app for Xcode Cloud =="

# Xcode Cloud's macOS images don't ship Node — Homebrew is available though.
if ! command -v node >/dev/null 2>&1; then
  echo "Node not found, installing via Homebrew..."
  brew install node
fi

cd "$CI_PRIMARY_REPOSITORY_PATH/client"

npm ci
npm run build

# Both the plugins' own Package.swift files AND @capacitor/cli itself (which
# hardcodes the same URL when it regenerates CapApp-SPM/Package.swift during
# `cap sync`, below) point at ionic-team/capacitor-swift-pm.git. Xcode Cloud
# can't be granted access to that repo — it belongs to the Ionic/Capacitor
# team, not us — so a build against it can never be authorized. We mirror
# that public package into our own org (HeyDer-Appp/capacitor-swift-pm) and
# redirect every reference to it here, since node_modules is reinstalled
# fresh on every build and none of this would survive past this one run
# otherwise.
echo "== HeyDer: redirecting capacitor-swift-pm to our own mirror =="
grep -rl "ionic-team/capacitor-swift-pm.git" node_modules/@capacitor --include="Package.swift" --include="*.js" \
  | while IFS= read -r f; do
      sed -i '' 's#https://github.com/ionic-team/capacitor-swift-pm.git#https://github.com/HeyDer-Appp/capacitor-swift-pm.git#g' "$f"
    done

# Rebuilds ios/App/App/public from dist/ and refreshes the native plugin
# list — the same sync step you'd run locally after a web change. Runs
# after the redirect above so the regenerated CapApp-SPM/Package.swift
# picks up the mirrored URL too.
npx cap sync ios

echo "== HeyDer: web app synced into the iOS project =="
