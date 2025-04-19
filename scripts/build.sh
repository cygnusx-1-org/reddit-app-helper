#!/bin/bash

MANIFEST_FILE="manifest.json"

VERSION=`cat ${MANIFEST_FILE} | jq -r '.["version"]'`

BUILD_DIR="builds"
ZIP_FILENAME="${BUILD_DIR}/reddit-app-helper-${VERSION}.zip"
XPI_FILENAME="${BUILD_DIR}/reddit-app-helper-${VERSION}.xpi"

FILE_LIST=`find . -maxdepth 1 -type f -name '*.js' -o -name '*.json'`

zip -q ${ZIP_FILENAME} ${FILE_LIST}

cp -a ${ZIP_FILENAME} ${XPI_FILENAME}
