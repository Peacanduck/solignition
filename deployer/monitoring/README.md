# Deployer monitoring stack

Prometheus + Grafana for the Solignition deployer. The deployer is **not** part
of this stack — it keeps running under pm2 on the host. Prometheus scrapes its
`/metrics` endpoint over the host loopback; Grafana queries Prometheus.

```
Deployer (pm2, host :3000)  ──scrape──►  Prometheus (:9090)  ──query──►  Grafana (:3001)
```

Adding this stack requires **no changes** to the deployer, pm2, git-pull, or
ngrok. Monitoring traffic is entirely internal to the VM — it never goes through
the public ngrok endpoint.

## Quick start

From the `deployer/` directory (or adjust the path):

```bash
# Set a Grafana admin password (don't ship the default).
export GF_SECURITY_ADMIN_PASSWORD='choose-something'

docker compose -f monitoring/docker-compose.yml up -d
```

Then reach Grafana at http://127.0.0.1:3001 (user `admin`). The Prometheus
datasource and the **Solignition Deployer** dashboard (folder: *Solignition*)
are provisioned automatically — no manual import.

Both Grafana (`3001`) and Prometheus (`9090`) bind to `127.0.0.1` only. To view
them from your laptop, SSH-tunnel rather than opening the ports publicly:

```bash
gcloud compute ssh <vm> -- -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090
```

## How Prometheus reaches the deployer

`prometheus.yml` targets `host.docker.internal:3000`, and the compose file maps
`host.docker.internal` to the host gateway (`extra_hosts`). This works on Docker
20.10+ on the Linux GCP VM and lets the container reach the pm2 process on the
host's `localhost:3000`.

Confirm the scrape target is healthy after startup:

```bash
curl -s localhost:9090/api/v1/targets | grep -o '"health":"[a-z]*"'
```

If the deployer runs somewhere other than the same host's `:3000` (e.g. a
separate box or a private VM IP), edit the `targets` list in
[`prometheus.yml`](prometheus.yml).

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Prometheus + Grafana services |
| `prometheus.yml` | Scrape config pointing at the deployer's `/metrics` |
| `grafana/provisioning/datasources/prometheus.yml` | Auto-adds Prometheus datasource (uid `prometheus`) |
| `grafana/provisioning/dashboards/dashboards.yml` | Loads dashboards from `grafana/dashboards/` |
| `grafana/dashboards/deployer.json` | The deployer dashboard |

## Notes / caveats

- **`/metrics` is unauthenticated.** Keep the deployer's `:3000` on the private
  network; only ngrok (API routes) should be public.
- **Deployment-duration p95** is estimated from prom-client's default histogram
  buckets, whose largest bucket is 10s. Deployments longer than 10s saturate at
  `+Inf`, so read p95 alongside the average panel. For accurate tail latency,
  give the `deployer_deployment_duration_seconds` histogram custom buckets in
  the deployer source.
- **Deployment status labels** are inconsistent in the source: failed
  deployments emit both `failure` and `failed`. The success-rate panel counts
  only `status="success"` as success, so it's correct regardless; the
  "Deployments by status" panel shows both series until the source is unified.
- **GCP-native alternative:** instead of self-hosting, Google Managed Service
  for Prometheus (via the Ops Agent) can scrape the same `/metrics` into Cloud
  Monitoring / a managed Grafana. This bundle is the self-hosted option.

## Tear down

```bash
docker compose -f monitoring/docker-compose.yml down        # keep data
docker compose -f monitoring/docker-compose.yml down -v     # also drop volumes
```
