#!/usr/bin/env bash
# Creates the notes-secrets Secret in-cluster with a random password.
# The value never touches the repo or shell history.
set -euo pipefail
kubectl create namespace notes --dry-run=client -o yaml | kubectl apply -f -
if kubectl -n notes get secret notes-secrets >/dev/null 2>&1; then
  echo "notes-secrets already exists, leaving it alone"; exit 0
fi
kubectl -n notes create secret generic notes-secrets \
  --from-literal=redis-password="$(openssl rand -hex 16)"
