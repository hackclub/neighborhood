#!/bin/bash

# All-in-one script to build, sign, notarize and create a clean DMG
# Now also builds for Windows and Linux without signing
# Usage: ./scripts/complete-build.sh

set -e  # Exit on any error

# Configuration
APP_NAME="Neighborhood"
APP_PATH="out/${APP_NAME}-darwin-arm64/${APP_NAME}.app"
APPLE_ID=""
APP_SPECIFIC_PASSWORD=""
TEAM_ID=""
ENTITLEMENTS="entitlements-minimal.plist"
DMG_NAME="${APP_NAME}.dmg"
TMP_DMG_DIR="tmp_dmg_dir"
FINAL_DMG_PATH="out/${DMG_NAME}"

echo "🚀 Starting complete build process..."

# Before build, add ELECTRON_DISABLE_SECURITY_WARNINGS=true and ELECTRON_ENABLE_LOGGING=true
export ELECTRON_DISABLE_SECURITY_WARNINGS=true
export ELECTRON_ENABLE_LOGGING=true
export FORCE_NO_KEYCHAIN=true  # Custom environment variable that our app can check

# Step 1: Clean and package the macOS app
echo "📦 Packaging the macOS app..."
npm run clean

# Create a build with our special flags
echo "Adding custom flags to disable keychain..."
electron-forge package --platform=darwin -- --disable-features=Credentials --use-mock-keychain --disable-cookie-encryption

# Step 2: Find the best certificate
echo "🔑 Finding available certificates..."
DEVELOPER_ID=$(security find-identity -v -p codesigning | grep "Developer ID Application" | head -1 | awk -F '"' '{print $2}')
DEV_CERT=$(security find-identity -v -p codesigning | grep "Apple Development" | head -1 | awk -F '"' '{print $2}')

if [ -n "$DEVELOPER_ID" ]; then
  IDENTITY="$DEVELOPER_ID"
  echo "✅ Using Developer ID certificate: $IDENTITY"
elif [ -n "$DEV_CERT" ]; then
  IDENTITY="$DEV_CERT"
  echo "⚠️ Using Development certificate: $IDENTITY"
else
  IDENTITY="-"
  echo "⚠️ No certificates found. Using ad-hoc signing."
fi

# Step 3: Remove extended attributes
echo "🧹 Removing extended attributes..."
find "$APP_PATH" -type f -exec xattr -c {} \;
find "$APP_PATH" -type d -exec xattr -c {} \;

# Special step: Remove ALL keychain and credential related files
echo "🔒 Removing keychain-related files..."
find "$APP_PATH" -name "*.keychain" -delete
find "$APP_PATH" -name "*Cookies*" -delete
find "$APP_PATH" -name "*Credential*" -delete
find "$APP_PATH" -name "*credential*" -delete
find "$APP_PATH" -name "*login*" -delete

# Create a special file to disable keychain at runtime
touch "$APP_PATH/Contents/Resources/disable_keychain"

# Step 4: Sign the app with explicit disable for keychain access
echo "🔒 Signing the app..."

# Sign all the frameworks and libraries first
echo "🔒 Signing frameworks and libraries..."
find "$APP_PATH/Contents/Frameworks" -type f -name "*.dylib" | while read -r file; do
  codesign --force --options runtime --no-strict --sign "$IDENTITY" "$file"
done

find "$APP_PATH/Contents/Frameworks" -name "*.framework" | while read -r framework; do
  codesign --force --options runtime --no-strict --sign "$IDENTITY" --entitlements "$ENTITLEMENTS" "$framework"
done

# Sign helper apps
if [ -d "$APP_PATH/Contents/Helpers" ]; then
  echo "🔒 Signing helper apps..."
  find "$APP_PATH/Contents/Helpers" -type f -perm +111 | while read -r helper; do
    codesign --force --options runtime --no-strict --sign "$IDENTITY" --entitlements "$ENTITLEMENTS" "$helper"
  done
fi

# Sign the main executable
codesign --force --options runtime --deep --no-strict --sign "$IDENTITY" --entitlements "$ENTITLEMENTS" "$APP_PATH/Contents/MacOS/Neighborhood"

# Finally sign the app bundle
codesign --force --options runtime --deep --no-strict --sign "$IDENTITY" --entitlements "$ENTITLEMENTS" "$APP_PATH"

# Step 5: Verify signature
echo "✅ Verifying signature..."
codesign --verify --verbose "$APP_PATH"

# Step 6: Skip notarization during build
echo "⚠️ Skipping notarization during build. Run ./scripts/notarize.sh separately after build completes."

# Step 7: Create a clean DMG with just the app
echo "💿 Creating a clean DMG with just the app..."

# Create a temporary directory for DMG contents
mkdir -p "$TMP_DMG_DIR"

# Copy the app to the temporary directory
cp -R "$APP_PATH" "$TMP_DMG_DIR/"

# Create a symbolic link to Applications
ln -s /Applications "$TMP_DMG_DIR/Applications"

# Set up DMG background and layout
mkdir -p "$TMP_DMG_DIR/.background"
# Create a simple background image (white)
convert -size 600x400 xc:white "$TMP_DMG_DIR/.background/background.png"

# Create the DMG with custom layout
hdiutil create -volname "$APP_NAME" -srcfolder "$TMP_DMG_DIR" -ov -format UDZO "$FINAL_DMG_PATH"

# Mount the DMG to set custom layout
DMG_DEVICE=$(hdiutil attach -readwrite -noverify "$FINAL_DMG_PATH" | egrep '^/dev/' | sed 1q | awk '{print $1}')
sleep 2

# Set the background image and icon positions
echo '
   tell application "Finder"
     tell disk "'"${APP_NAME}"'"
           open
           set current view of container window to icon view
           set toolbar visible of container window to false
           set statusbar visible of container window to false
           set the bounds of container window to {400, 100, 1000, 500}
           set viewOptions to the icon view options of container window
           set arrangement of viewOptions to not arranged
           set icon size of viewOptions to 72
           set background picture of viewOptions to file ".background:background.png"
           set position of item "'"${APP_NAME}.app"'" of container window to {100, 100}
           set position of item "Applications" of container window to {300, 100}
           close
           open
           update without registering applications
           delay 2
     end tell
   end tell
' | osascript

# Make sure everything is written to disk
sync

# Unmount the DMG
hdiutil detach "$DMG_DEVICE"

# Clean up temporary directory
rm -rf "$TMP_DMG_DIR"

# Step 8: Build for Windows and Linux
echo "🏗️ Building for Windows and Linux..."

# Create temporary directories for clean builds
WIN_TMP_DIR="out/win-tmp"
LINUX_TMP_DIR="out/linux-tmp"
mkdir -p "$WIN_TMP_DIR" "$LINUX_TMP_DIR"

# Build for Windows with minimal files
echo "🪟 Building for Windows..."
# Create basic package structure
electron-forge package --platform=win32 --arch=x64

# Clean up Windows package by copying only what's needed
echo "🧹 Cleaning Windows package..."
WIN_SRC="out/${APP_NAME}-win32-x64"
mkdir -p "$WIN_TMP_DIR/app"
cp -R "$WIN_SRC"/* "$WIN_TMP_DIR/app/"

# Remove unnecessary files from Windows package
find "$WIN_TMP_DIR" -name "*.pdb" -delete
find "$WIN_TMP_DIR" -name "*.map" -delete
find "$WIN_TMP_DIR" -name "*.log" -delete
find "$WIN_TMP_DIR" -path "*/node_modules/.cache/*" -delete
rm -rf "$WIN_TMP_DIR/app/resources/inspector"

# Create Windows distributable from the cleaned files
echo "📦 Creating Windows distributable..."
# Create a simple zip for Windows
cd "$WIN_TMP_DIR" || exit
zip -r "../${APP_NAME}-win32-x64.zip" .
cd ../../ || exit

# Build for Linux with minimal files
echo "🐧 Building for Linux..."
# Create basic package structure
electron-forge package --platform=linux --arch=x64

# Clean up Linux package by copying only what's needed
echo "🧹 Cleaning Linux package..."
LINUX_SRC="out/${APP_NAME}-linux-x64"
mkdir -p "$LINUX_TMP_DIR/app"
cp -R "$LINUX_SRC"/* "$LINUX_TMP_DIR/app/"

# Remove unnecessary files from Linux package
find "$LINUX_TMP_DIR" -name "*.map" -delete
find "$LINUX_TMP_DIR" -name "*.log" -delete
find "$LINUX_TMP_DIR" -path "*/node_modules/.cache/*" -delete
rm -rf "$LINUX_TMP_DIR/app/resources/inspector"

# Create Linux distributable from the cleaned files
echo "📦 Creating Linux distributable..."
# Create a simple tar.gz for Linux
cd "$LINUX_TMP_DIR" || exit
tar -czf "../${APP_NAME}-linux-x64.tar.gz" .
cd ../../ || exit

# Clean up temporary directories
rm -rf "$WIN_TMP_DIR" "$LINUX_TMP_DIR"

echo "✅ Process complete!"
echo "📝 macOS DMG created at: $FINAL_DMG_PATH"
echo "📝 Windows ZIP created at: out/${APP_NAME}-win32-x64.zip"  
echo "📝 Linux TAR.GZ created at: out/${APP_NAME}-linux-x64.tar.gz"
echo "📝 You can distribute these files" 