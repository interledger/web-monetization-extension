#!/bin/bash -u

set -e

TARGET=${1}

ENV=production
BROWSERS=("chrome" "firefox" "edge" "opera")
COMMAND="NODE_ENV=${ENV}"

if echo "${BROWSERS[@]}" | grep -qw "${TARGET}" ; then
  COMMAND="${COMMAND} TARGET=${TARGET} pnpm webpack"
elif [[ ${TARGET} == '' ]] ; then
  COMMAND="${COMMAND} pnpm concurrently"
  for BROWSER in "${BROWSERS[@]}" ; do
    COMMAND="${COMMAND} \"TARGET=${BROWSER} pnpm webpack\""
  done
else
  echo "${TARGET} was not found"
  exit 1
fi

eval "${COMMAND}"
