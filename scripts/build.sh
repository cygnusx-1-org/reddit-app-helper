#!/bin/bash

function file_list {
  FILE_LIST=`find . -maxdepth 1 -type f -name '*.js' -o -name ${MANIFEST_FILENAME} ; find assets -type f`
}

MANIFEST_FILENAME="manifest.json"
MANIFEST_CHROME_FILENAME="manifest-chrome.json"
MANIFEST_FIREFOX_FILENAME="manifest-firefox.json"

CHROME_VERSION=`cat ${MANIFEST_CHROME_FILENAME} | jq -r '.["version"]'`
FIREFOX_VERSION=`cat ${MANIFEST_FIREFOX_FILENAME} | jq -r '.["version"]'`

BUILD_DIR="builds"

ZIP_FILENAME="${BUILD_DIR}/reddit-app-helper-${CHROME_VERSION}.crx"
XPI_FILENAME="${BUILD_DIR}/reddit-app-helper-${FIREFOX_VERSION}.xpi"

# Chrome
mv ${MANIFEST_CHROME_FILENAME} ${MANIFEST_FILENAME}

file_list

zip -q ${ZIP_FILENAME} ${FILE_LIST}

mv ${MANIFEST_FILENAME} ${MANIFEST_CHROME_FILENAME}

# Firefox
mv ${MANIFEST_FIREFOX_FILENAME} ${MANIFEST_FILENAME}

file_list

zip -q ${XPI_FILENAME} ${FILE_LIST}

mv ${MANIFEST_FILENAME} ${MANIFEST_FIREFOX_FILENAME}
