#!/usr/bin/env bash
# Local stand-in for a GitOps controller: apply whatever the overlay in git says.
# CI commits the new image tag to k8s/overlays/local; this applies it.
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
scripts/create-secret.sh
kubectl apply -k k8s/overlays/local
kubectl -n notes rollout status deployment/notes-app --timeout=180s
