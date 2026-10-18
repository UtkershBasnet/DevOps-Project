#!/usr/bin/env bash
# End-to-end check of the user journey; prints evidence tying the running version to the commit.
set -euo pipefail
kubectl -n notes port-forward svc/notes-app 8080:80 >/dev/null 2>&1 &
PF=$!
trap 'kill $PF 2>/dev/null' EXIT
for _ in $(seq 20); do curl -fs localhost:8080/readyz >/dev/null && break; sleep 1; done

echo "== running version";  curl -fs localhost:8080/version; echo
echo "== image in cluster";  kubectl -n notes get deploy notes-app -o jsonpath='{.spec.template.spec.containers[0].image}'; echo
echo "== repo HEAD";         git rev-parse --short HEAD
echo "== create note";       curl -fs -X POST -H 'content-type: application/json' -d '{"text":"verify run"}' localhost:8080/notes; echo
echo "== list notes";        curl -fs localhost:8080/notes; echo
echo "== metrics sample";    curl -fs localhost:8080/metrics | grep -E '^(http_request_duration_seconds_count|notes_app_build_info)' | head -5
echo "OK"
