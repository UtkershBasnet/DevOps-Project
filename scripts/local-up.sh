#!/usr/bin/env bash
# Build the current commit, load it into kind, deploy, wait for rollout.
set -euo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse --short HEAD)
IMAGE=notes-app:${SHA}

kind get clusters | grep -qx notes || kind create cluster --config k8s/kind-config.yaml
docker build --build-arg APP_VERSION="$SHA" --build-arg GIT_SHA="$(git rev-parse HEAD)" -t "$IMAGE" .
kind load docker-image "$IMAGE" --name notes

scripts/create-secret.sh
# render with the freshly built tag without editing tracked files
(cd k8s/overlays/local && kubectl kustomize . ) \
  | sed "s|image: notes-app:local|image: ${IMAGE}|" | kubectl apply -f -
kubectl apply -f k8s/observability/monitoring.yaml

kubectl -n notes rollout status statefulset/redis --timeout=120s
kubectl -n notes rollout status deployment/notes-app --timeout=120s
echo "deployed ${IMAGE}"
