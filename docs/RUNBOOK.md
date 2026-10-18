# Runbook

## Is it healthy?
```bash
kubectl -n notes get pods                      # all Ready
kubectl -n notes get deploy notes-app -o jsonpath='{.spec.template.spec.containers[0].image}'
scripts/verify.sh                              # user journey + running version
```

## High error rate
Symptom: alert `NotesHighErrorRate` / availability panel < 99%.
1. Did a release just happen? `kubectl -n notes rollout history deploy/notes-app`; compare `/version` with the release commit.
2. Logs: `kubectl -n notes logs deploy/notes-app --since=10m | grep '"status":5'`
3. Dependency: `kubectl -n notes get pods -l app=redis`, `curl /readyz`.
4. Mitigate: `kubectl -n notes rollout undo deploy/notes-app`. Verify: availability returns ≥ 99%, `scripts/verify.sh` prints OK.

## Redis down
Readiness fails → pods removed from the Service → 503/connection errors. Data is on the PVC.
`kubectl -n notes describe pod redis-0`, check PVC bound; after Redis returns, pods become Ready by themselves.

## Fault drill (optional demo)
```bash
kubectl -n notes scale statefulset/redis --replicas=0     # inject fault
# Symptom: /readyz 503, pods NotReady. Hypothesis: dependency loss. Evidence: pod events, redis error logs.
kubectl -n notes scale statefulset/redis --replicas=1     # fix
scripts/verify.sh                                         # verify; earlier notes are still listed (PVC)
```

## Bad release drill
Deploy an image that fails readiness (e.g. set a wrong `REDIS_URL`): with `maxUnavailable: 0` the old pods keep serving
and `rollout status` hangs; run `rollout undo`.

## NetworkPolicy enforcement on kind
```bash
kind delete cluster --name notes
# create with disableDefaultCNI: true, then install Calico, then run scripts/local-up.sh
```
