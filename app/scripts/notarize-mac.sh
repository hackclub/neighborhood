#!/bin/bash

# macOS app notarization script
# This script notarizes a signed app with Apple servers

set -e  # Exit on any error

APP_PATH=${1:-"out/Neighborhood-darwin-arm64/Neighborhood.app"}
APP_SPECIFIC_PASSWORD=""
TEAM_ID=""
APPLE_ID=""  # Hardcoded Apple ID

# Ensure the app exists
if [ ! -d "$APP_PATH" ]; then
  echo "❌ ERROR: App not found at $APP_PATH"
  exit 1
fi

echo "🔍 Validating app signature before notarization..."
codesign --verify --deep --strict "$APP_PATH" || {
  echo "❌ ERROR: App signature validation failed. The app must be signed with a Developer ID certificate before notarization."
  exit 1
}

# Create a zip file for notarization
ZIP_PATH="${APP_PATH%.*}.zip"
echo "📦 Creating zip file for notarization: $ZIP_PATH"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

echo "🔐 Submitting app for notarization..."
echo "⏳ This process may take several minutes..."
echo "🔑 Using Apple ID: $APPLE_ID"
echo "🔑 Team ID: $TEAM_ID"

# Submit for notarization and capture the submission ID
SUBMIT_OUTPUT=$(xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID" \
  )

echo "$SUBMIT_OUTPUT"

# Extract submission ID
SUBMISSION_ID=$(echo "$SUBMIT_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')

if [ -z "$SUBMISSION_ID" ]; then
  echo "❌ ERROR: Failed to get submission ID"
  exit 1
fi

echo "📋 Getting detailed notarization log..."
xcrun notarytool log --apple-id "$APPLE_ID" --password "$APP_SPECIFIC_PASSWORD" --team-id "$TEAM_ID" "$SUBMISSION_ID" notarization.log

echo "📝 Detailed notarization log saved to notarization.log"
echo "📝 Showing log contents:"
cat notarization.log

# Check if notarization succeeded
STATUS=$(echo "$SUBMIT_OUTPUT" | grep "status:" | tail -1 | awk '{print $2}')

if [ "$STATUS" != "Accepted" ]; then
  echo "❌ ERROR: Notarization failed with status: $STATUS"
  echo "❌ See notarization.log for details"
  echo "⚠️ The app will still work if you right-click and choose Open"
  echo "⚠️ You can try with a newer version of Electron, or with fewer entitlements"
  exit 1
fi

echo "⚙️ Stapling the notarization ticket to the app..."
xcrun stapler staple "$APP_PATH"

echo "✅ Verification after stapling:"
xcrun stapler validate "$APP_PATH"

echo "✅ Notarization complete!"
echo "📝 The app should now be trusted by macOS Gatekeeper."
echo "📝 You can distribute the app or create a DMG for distribution." 