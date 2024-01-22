#!/bin/bash -u 

set -ex

TARGET=${1:-chrome}
NODE_ENV=development

echo Running ${NODE_ENV} build for ${TARGET}...
NODE_ENV=${NODE_ENV} TARGET=${TARGET} pnpm webpack
