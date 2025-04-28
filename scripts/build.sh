#!/bin/bash

function file_list {
  FILE_LIST=`find . -maxdepth 1 -type f -name '*.js' -o -name ${MANIFEST_FILENAME} ; find assets -type f`
}

BUILD_DIR="../builds"
MANIFEST_FILENAME="manifest.json"

# Chrome
cd chrome
CHROME_VERSION=`cat ${MANIFEST_FILENAME} | jq -r '.["version"]'`
ZIP_FILENAME="${BUILD_DIR}/reddit-app-helper-${CHROME_VERSION}.zip"

file_list

zip -q ${ZIP_FILENAME} ${FILE_LIST}

cd ..

# Firefox
cd firefox
FIREFOX_VERSION=`cat ${MANIFEST_FILENAME} | jq -r '.["version"]'`
XPI_FILENAME="${BUILD_DIR}/reddit-app-helper-${FIREFOX_VERSION}.xpi"

file_list

zip -q ${XPI_FILENAME} ${FILE_LIST}
