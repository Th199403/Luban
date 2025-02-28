#!/bin/bash

PLATFORM=`node -e "console.log(process.platform)"`
DEST_DIR="dist/Luban"

#
# cleanup
#
rm -rf output
mkdir output

rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"

cp -af src/package.json "$DEST_DIR"

#
# compile src
#
SOURCE_DIR="$DEST_DIR/src"
mkdir -p "$SOURCE_DIR"

npm run pkgsync
cp -af src/package.json "$SOURCE_DIR"

pushd src
cross-env NODE_ENV=production babel "*.js" --config-file ../babel.config.js -d "../$SOURCE_DIR"
cross-env NODE_ENV=production babel "electron-app/**/*.js" --config-file ../babel.config.js -d "../$SOURCE_DIR/electron-app"
popd

#
# Resources Directory
#
RESOURCES_DIR="$DEST_DIR/resources"
mkdir -p "$RESOURCES_DIR"

#
# Copy Print Settings
#
PRINT_SETTING_DIR="$RESOURCES_DIR/print-settings"
mkdir -p "$PRINT_SETTING_DIR"

cp -r packages/luban-print-settings/resources/cnc "$PRINT_SETTING_DIR"
cp -r packages/luban-print-settings/resources/laser "$PRINT_SETTING_DIR"
cp -r packages/luban-print-settings/resources/printing "$PRINT_SETTING_DIR"

#
# Copy other resources
#
cp -r resources/fonts "$RESOURCES_DIR"
cp -r resources/luban-case-library "$RESOURCES_DIR"
cp -r resources/scenes "$RESOURCES_DIR"
cp -r resources/ProfileDocs "$RESOURCES_DIR"
