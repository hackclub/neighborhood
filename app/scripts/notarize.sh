#!/bin/bash

# Configuration
APP_NAME="Neighborhood"
APP_PATH="out/${APP_NAME}-darwin-arm64/${APP_NAME}.app"
APPLE_ID=""
APP_SPECIFIC_PASSWORD=""
TEAM_ID=""

echo "🔐 Starting notarization process..."

# Create zip for notarization
ZIP_PATH="${APP_PATH%.*}.zip"
echo "📦 Creating zip file for notarization: $ZIP_PATH"
ditto -c -k --keepParent "$APP_PATH" "$ZIP_PATH"

# Submit for notarization without waiting
echo "📤 Submitting to Apple for notarization..."
SUBMIT_OUTPUT=$(xcrun notarytool submit "$ZIP_PATH" \
  --apple-id "$APPLE_ID" \
  --password "$APP_SPECIFIC_PASSWORD" \
  --team-id "$TEAM_ID" \
  --no-wait \
  --verbose)

echo "📝 Submission output:"
echo "$SUBMIT_OUTPUT"

# Extract submission ID
SUBMISSION_ID=$(echo "$SUBMIT_OUTPUT" | grep "id:" | head -1 | awk '{print $2}')

if [ -n "$SUBMISSION_ID" ]; then
  echo "✅ Notarization submitted with ID: $SUBMISSION_ID"
  
  # Check status in a loop
  echo "⏳ Checking notarization status..."
  while true; do
    STATUS_OUTPUT=$(xcrun notarytool info "$SUBMISSION_ID" \
      --apple-id "$APPLE_ID" \
      --password "$APP_SPECIFIC_PASSWORD" \
      --team-id "$TEAM_ID")
    
    echo "📝 Status check output:"
    echo "$STATUS_OUTPUT"
    
    if echo "$STATUS_OUTPUT" | grep -q "status: Accepted"; then
      echo "✅ Notarization completed successfully!"
      break
    elif echo "$STATUS_OUTPUT" | grep -q "status: Invalid"; then
      echo "❌ Notarization failed!"
      exit 1
    elif echo "$STATUS_OUTPUT" | grep -q "status: In Progress"; then
      echo "⏳ Still in progress... waiting 30 seconds"
      sleep 30
    else
      echo "⚠️ Unknown status, waiting 30 seconds"
      sleep 30
    fi
  done
  
  # Staple the ticket to the app
  echo "📎 Stapling the notarization ticket..."
  xcrun stapler staple "$APP_PATH"
  
  # Verify the staple
  echo "✅ Verifying the staple..."
  xcrun stapler validate "$APP_PATH"
else
  echo "❌ Failed to extract submission ID from output"
  exit 1
fi

# Clean up
rm -f "$ZIP_PATH"

echo "✅ Notarization process completed!" 