#!/bin/bash

npm uninstall --location=global notion-translator &&
  rm -f notion-translator-*.tgz &&
  npm pack &&
  npm install --location=global ./notion-translator-*.tgz
