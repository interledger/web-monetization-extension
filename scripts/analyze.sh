#!/bin/bash -u

set -e

TARGET=${1:-chrome}
NODE_ENV=profile

echo Running ${NODE_ENV} build for ${TARGET}...
NODE_ENV=${NODE_ENV} TARGET=${TARGET} pnpm webpack
