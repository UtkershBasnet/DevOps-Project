# notes-app

Tiny notes API (Express + Redis) used as a DevOps reference project.

- `POST /notes` `{"text": "..."}` · `GET /notes`
- `GET /healthz` (liveness) · `GET /readyz` (readiness, checks Redis) · `GET /version` · `GET /metrics`

## Baseline vs. final

| | |
|---|---|
| Baseline commit | tag `baseline` (`3188f91dfdd6137d35b74613960e986661798d33`) |
| Baseline contents | plain app + unit tests. No Docker, Kubernetes, CI, metrics, health checks or security config. |
| Final | branch `devops-improvements` (one PR into `main`) |

Compare: `git diff baseline..devops-improvements --stat`

## What was added

| Area | Where |
|---|---|
| Container image (multi-stage, non-root) | `Dockerfile` |
| Kubernetes (Deployment, StatefulSet+PVC, probes, HPA, PDB, NetworkPolicy) | `k8s/base/` |
| Config per environment (Kustomize overlay, image tag pinning) | `k8s/overlays/local/` |
| CI/CD (test, secret scan, audit, manifest validation, Trivy, build, approved release) | `.github/workflows/ci.yml` |
| Observability (Prometheus metrics, JSON logs, SLO rule, alerts, Grafana dashboard) | `src/app.js`, `k8s/observability/` |
| Security (secrets out of git, securityContext, default-deny network, scans) | see `docs/DECISIONS.md` |
| Decisions, runbook | `docs/` |

## Prerequisites

Docker, [kind](https://kind.sigs.k8s.io/), kubectl, git, openssl, curl. Node 20 only for running tests outside Docker.

## Run it locally

```bash
npm ci && npm test          # unit tests
scripts/local-up.sh         # kind cluster + build + load image + deploy + wait
scripts/verify.sh           # end-to-end journey + version evidence
```

Dashboards:

```bash
kubectl -n monitoring port-forward svc/grafana 3001:3000      # http://localhost:3001  (dashboard "Notes App")
kubectl -n monitoring port-forward svc/prometheus 9090:9090   # http://localhost:9090  (alerts tab)
```

Release flow (needs a GitHub repo): merge to `main` → CI builds `ghcr.io/<repo>:<sha>`, scans it, an approver releases on
the `production` environment, CI commits the pinned tag to `k8s/overlays/local`, then `scripts/sync.sh` applies it.

Rollback: `kubectl -n notes rollout undo deployment/notes-app` or `git revert` the release commit and run `scripts/sync.sh`.

## Known limitations

- Single Redis replica: a Redis pod restart keeps data (PVC + AOF) but is briefly unavailable; no HA.
- kind's default CNI does not enforce NetworkPolicy; install Calico to see them enforced (see runbook).
- No ingress controller; access is via `port-forward`.
- `sync.sh` is a manual stand-in for a GitOps controller such as Argo CD.
- No distributed tracing; one service plus Redis makes metrics + request logs sufficient (see decisions).
- The `release` job pushes to `main`; if branch protection blocks that, use a PR-based bot or a deploy key.
