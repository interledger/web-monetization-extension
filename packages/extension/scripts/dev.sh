#!/bin/bash -u 

set -ex

TARGET=${1:-chrome}
NODE_ENV=development

echo Running ${NODE_ENV} build for ${TARGET}...
pnpm concurrently -n SIGNATURES,EXTENSION -c green.bold,blue.bold "pnpm local-signatures" "NODE_ENV=${NODE_ENV} TARGET=${TARGET} webpack"
