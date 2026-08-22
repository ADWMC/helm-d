#!/usr/bin/env bash
set -euo pipefail
apk="${1:?usage: fingerprint.sh <file.apk|file.xapk>}"
[ -f "$apk" ] || { echo "not a file: $apk" >&2; exit 1; }
echo "target: $apk"
echo "size: $(wc -c < "$apk") bytes"
echo "sha256: $(sha256sum "$apk" | awk '{print $1}')"
# 骨架占位：实际指纹逻辑待实现
echo "framework: unknown (TODO: Flutter/RN/Cordova/Xamarin)"
echo "http_stack: unknown (TODO: Retrofit/OkHttp/Ktor/Volley/Apollo)"
