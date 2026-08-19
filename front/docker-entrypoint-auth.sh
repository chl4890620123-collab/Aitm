#!/bin/sh
set -eu
: "${AITM_APP_USERNAME:?AITM_APP_USERNAME is required}"
: "${AITM_APP_PASSWORD:?AITM_APP_PASSWORD is required}"
htpasswd -bc /etc/nginx/.htpasswd "$AITM_APP_USERNAME" "$AITM_APP_PASSWORD"
exec nginx -g 'daemon off;'
