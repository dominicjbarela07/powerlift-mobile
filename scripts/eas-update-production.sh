#!/usr/bin/env bash
set -euo pipefail

echo 'Production OTA blocked: this historical main checkout is retired as a publication source. Use a clean governed Production 2.0.2 release projection created from canonical source.' >&2
exit 1
