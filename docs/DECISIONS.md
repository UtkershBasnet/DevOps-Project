# Design decisions

## Architecture and request path
client → Service `notes-app` → Pod (Express) → headless Service `redis` → Redis pod (PVC).
Failure boundaries: if Redis is down, `/readyz` fails (503), pods leave the Service endpoints and clients get
connection errors rather than half-working responses. The process is not restarted, because `/healthz`
does not check dependencies (restarting the app would not fix Redis). Linux concepts used: non-root UID, read-only
root filesystem, dropped capabilities, SIGTERM handling for graceful shutdown.

## Kubernetes
| Choice | Why | Would change if |
|---|---|---|
| Deployment for the app | stateless, any replica is equal | n/a |
| StatefulSet + PVC for Redis | stable identity and storage for data | Redis needs HA → Sentinel/operator, or a managed service |
| `maxUnavailable: 0`, `maxSurge: 1` | zero capacity loss during rollouts | cluster is too small to surge |
| Three probes: startup, readiness, liveness | readiness depends on Redis; liveness deliberately does not | |
| Requests + memory limit, no CPU limit | avoids CPU throttling latency; HPA needs CPU requests | strict multi-tenant quota |
| HPA 2–5 on CPU, PDB minAvailable 1 | survive load and node drains | |
| topologySpread (soft) | spread replicas when more nodes exist | |

## Configuration
Kustomize base + overlay: one set of manifests, environment differences only in overlays, no copy-pasted YAML,
so no drift. Chosen over Helm because there is a single environment and no templating needs. Helm becomes
attractive when packaging for other teams or when values need logic.

## CI/CD and release
- PR: tests, gitleaks, `npm audit`, manifest schema validation, image build + Trivy scan (HIGH/CRITICAL fail).
- main: also pushes the image tagged with the full commit SHA. Tags are immutable-by-convention; never `latest`.
- Release: a job bound to the `production` GitHub environment (required reviewers = manual approval) commits the
  pinned SHA to the overlay. Git is the record of what should be running; `kubectl get deploy -o image` and
  `/version` show what is running; a mismatch means drift.
- Strategy: rolling update with readiness gating. Blue-green/canary would need an ingress/mesh and double capacity;
  not justified for a stateless two-replica app with fast rollback.
- Recovery: `kubectl rollout undo`, or revert the release commit (preferred, keeps git truthful).

## Observability and reliability
- Metrics: request latency histogram per route/status, default Node metrics, `notes_app_build_info`.
- Logs: one JSON line per request (method, route, status, ms); health/metrics probes excluded to cut noise.
- Tracing: skipped. One service and one datastore; a latency histogram + logs localise problems adequately.
  Would add OpenTelemetry once a second service appears.
- SLO: 99% of requests non-5xx (5m window for demo; use 30d in production). Alerts: high error rate (page; action:
  rollback), p95 > 500ms (ticket), pod not scrapeable (page).
- "Healthy" = all pods Ready, availability SLI ≥ 99%, p95 < 500ms. Recovery is verified by `scripts/verify.sh` and the SLI returning above target.

## Security
- Secret: Redis password generated in-cluster by `scripts/create-secret.sh`; only `*.example.yaml` is in git; `.gitignore` blocks `*.secret.yaml`; gitleaks in CI.
  For production use External Secrets/Sealed Secrets, since Kubernetes Secrets are only base64.
- Pod hardening: non-root, no privilege escalation, drop all capabilities, seccomp RuntimeDefault, read-only root FS (app).
- Permissions: the app's ServiceAccount token is not mounted; Prometheus gets a namespaced read-only Role on pods.
- Exposure: ClusterIP only; default-deny NetworkPolicy with explicit allows (app→redis, app→DNS, any→app:3000, app→redis only).
- Supply chain: multi-stage image, pinned base major, Trivy scan, Dependabot, `npm audit`.
