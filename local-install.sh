#!/bin/bash

npm uninstall -g notion-translator &&
  rm -f notion-translator-*.tgz &&
  npm pack &&
  npm install -g ./notion-translator-*.tgz
