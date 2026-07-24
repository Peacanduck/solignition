# Solana Lending Protocol Deployer Service

## Overview

The Solana Lending Protocol Deployer Service is an off-chain service that monitors the on-chain lending protocol and automatically deploys Solana programs when loans are requested, and recovers SOL when loans expire.

## Architecture

### Components

1. **Event Monitor**: Listens to on-chain events via WebSocket and polling
2. **Program Deployer**: Handles BPF program deployment with proper authority management
3. **State Manager**: Maintains persistent state using LevelDB for idempotency
4. **Binary Manager**: Stores and validates program binaries
5. **Orchestrator**: Coordinates all components and handles retry logic
6. **Health Server**: Provides HTTP endpoints for health checks and metrics

### Flow Diagrams

```
Loan Request Flow:
1. LoanRequested event → Event Monitor
2. Event Monitor → Orchestrator
3. Orchestrator → Binary Manager (validate & store)
4. Orchestrator → Program Deployer (deploy)
5. Program Deployer → set_deployed_program (on-chain)
6. Update State → Mark as deployed

Recovery Flow:
1. LoanRecovered/Expired → Event Monitor
2. Event Monitor → Orchestrator
3. Orchestrator → Program Deployer (close program)
4. Program Deployer → return_reclaimed_sol (on-chain)
5. Update State → Mark as recovered
```

## Setup Guide

### Prerequisites

- Node.js 18+
- Solana CLI tools
- Docker (optional)
- Access to Solana RPC endpoint

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd solana-lending-deployer
```

2. Install dependencies:
```bash
npm install
```

3. Build the TypeScript code:
```bash
npm run build
```

4. Create keypairs:
```bash
# Generate deployer keypair
solana-keygen new -o keys/deployer-keypair.json

# Admin keypair (if needed for set_deployed_program)
solana-keygen new -o keys/admin-keypair.json
```

5. Configure environment:
```bash
cp .env.example .env
# Edit .env with your configuration
```

### Configuration

#### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RPC_URL` | Solana RPC endpoint URL | `http://127.0.0.1:8899` |
| `WS_URL` | WebSocket endpoint URL (optional) | - |
| `PROGRAM_ID` | Lending protocol program ID | - |
| `CLUSTER` | Solana cluster | `devnet` |
| `DEPLOYER_KEYPAIR_PATH` | Path to deployer keypair | `./deployer-keypair.json` |
| `ADMIN_KEYPAIR_PATH` | Path to admin keypair (optional) | - |
| `BINARY_STORAGE_PATH` | Directory for storing binaries | `./binaries` |
| `DB_PATH` | LevelDB database path | `./deployer-state` |
| `PORT` | HTTP server port | `3000` |
| `LOG_LEVEL` | Winston log level | `info` |
| `MAX_RETRIES` | Max retry attempts | `3` |
| `RETRY_DELAY_MS` | Base retry delay in ms | `5000` |
| `POLL_INTERVAL_MS` | Polling interval for expired loans | `30000` |

### Running the Service

#### Local Development

```bash
# Run with ts-node-dev (auto-restart on changes)
npm run dev

# Or run compiled version
npm start
```

#### Docker

```bash
# Build Docker image
docker build -t solana-lending-deployer .

# Run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f deployer
```

#### Production Deployment

1. Use a process manager like PM2:
```bash
npm install -g pm2
pm2 start dist/index.js --name solana-deployer
pm2 save
pm2 startup
```

2. Or deploy to Kubernetes:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: solana-deployer
spec:
  replicas: 1
  selector:
    matchLabels:
      app: solana-deployer
  template:
    metadata:
      labels:
        app: solana-deployer
    spec:
      containers:
      - name: deployer
        image: solana-lending-deployer:latest
        envFrom:
        - configMapRef:
            name: deployer-config
        volumeMounts:
        - name: keys
          mountPath: /app/keys
          readOnly: true
        - name: storage
          mountPath: /app/binaries
        - name: state
          mountPath: /app/deployer-state
```

## Binary Management

### Binary Retrieval Options

The service needs to retrieve `.so` binaries for deployment. Implement one of these strategies:

#### Option 1: IPFS Integration
```typescript
// Add to fetchBinaryForLoan method
const ipfsHash = await getLoanMetadata(loanId).ipfsHash;
const binary = await ipfs.cat(ipfsHash);
```

#### Option 2: Pre-upload with Signature
```typescript
// Borrowers upload binaries before loan request
POST /binaries/upload
Authorization: Signature from borrower
Body: Binary data

// Deployer retrieves by loan ID
const binary = await getBinaryByLoanId(loanId);
```

#### Option 3: Direct URL with Verification
```typescript
// Loan includes binary URL in metadata
const binaryUrl = await getLoanMetadata(loanId).binaryUrl;
const binary = await fetch(binaryUrl);
// Verify hash matches on-chain record
```

### Binary Validation

The service validates binaries before deployment:
- ELF header check
- Size limits (configurable, default 100MB)
- Optional: Static analysis for malicious code
- Hash verification against on-chain records

## Reliability & storage

### Restart durability (deploys resume after a restart)

Accepting a borrow returns `201` immediately and the actual deploy runs in the
background. To make that durable, the loan→binary link is persisted as a
`pending` deployment record **before** the deploy is scheduled (in the
`POST /v1/loans` and `POST /v1/projects` handlers). On-chain loan state is the
work queue: the reconciliation sweep `checkPendingLoansForDeployment` finds
loans that are still on-chain `pending` and deploys (or resumes) them from their
record. So a deployer restart/crash — including during a deploy — does not drop
an accepted deploy; the next sweep picks it up.

- The deploy step is **not** idempotent (each run mints a new program account),
  so an in-memory in-flight set + the persisted `status` prevent the in-memory
  timer and the reconciliation sweep from double-deploying one loan. On boot the
  set is empty, so any record left in `deploying` is known-orphaned and resumed.
- Repayment → authority transfer is recovered the same way off on-chain
  `RepaidPendingTransfer` state (`checkPendingAuthTransfers`).
- Sweep cadence is configurable: `RECONCILE_INTERVAL_MS` (default `600000` = 10
  min) and `RECONCILE_INITIAL_DELAY_MS` (default `20000` = first sweep 20s after
  boot).

### Known limitation — NOT designed for long-term durable storage

This service stores everything on the **VM's local disk** and is a single
instance:

- **Binaries** live at `BINARY_STORAGE_PATH` (default `./binaries`) as
  `{fileId}_{hash}.so`. They survive a process (pm2) restart but **not VM loss**,
  and there is **no retention/cleanup** — they accumulate until an explicit
  `DELETE /v1/uploads/:fileId`. Long-running instances will grow disk unbounded.
- **All off-chain state** (deployments, projects, uploads) is in a local LevelDB
  at `DB_PATH` (default `./deployer-state`) on that same disk — a single point of
  failure, not backed up.

**Recommended follow-ups (not yet implemented):**
- Move binaries to durable object storage (S3 / Azure Blob) + a retention policy
  (e.g. purge binaries for repaid/recovered/expired loans).
- Back up or externalize the LevelDB state.
- A real job queue (Redis/BullMQ) is only worth it when scaling off the single VM
  or to multiple deploy workers; today the on-chain-state-driven reconciliation
  is the durable queue and needs no extra infrastructure.

## Monitoring

### Health & spec endpoints

- `GET /health` — service health status (returns `{"status":"ok"}`)
- `GET /metrics` — Prometheus metrics
- `GET /openapi.json` — machine-readable OpenAPI 3.1 spec for the v1 API
- `GET /docs` — Swagger UI rendered from the spec (the canonical, always-current API reference)

### Metrics

Available Prometheus metrics:
- `deployer_deployments_total{status}` - Total deployments by status
- `deployer_recovery_total{status}` - Total expired-loan recoveries by status
- `deployer_deployment_duration_seconds` - Deployment operation duration (histogram)
- `deployer_active_loans` - Currently active loans being monitored
- `deployer_file_uploads_total` - Total file uploads
- `deployer_expired_loans_checked_total` - Expired-loan checks performed
- `deployer_expired_loans_recovered_total` - Expired loans recovered
- `deployer_validation_rejected_total{reason}` - `/upload` requests rejected by validation
- `deployer_http_auth_failures_total{code,endpoint}` - Wallet-signature auth failures

### Prometheus + Grafana

A self-contained monitoring stack lives in [`monitoring/`](monitoring/). It runs
Prometheus and Grafana as containers that scrape the deployer's `/metrics`
endpoint over the host loopback — the deployer itself stays on pm2, untouched.

```bash
docker compose -f monitoring/docker-compose.yml up -d
```

Grafana is published on `127.0.0.1:3001` (admin password via
`GF_SECURITY_ADMIN_PASSWORD`) with the Prometheus datasource and the
**Solignition Deployer** dashboard auto-provisioned. See
[`monitoring/README.md`](monitoring/README.md) for setup and GCP notes.

Dashboard panels:
- Active loans gauge
- Deployment success rate
- Deployments / recoveries by status
- Deployment duration (average + p95)
- Upload validation rejections by reason
- Auth failures by code
- Expired loans checked vs recovered

## Security Considerations

### Key Management

1. **Never commit private keys**: Use environment variables or secret management
2. **Separate keys by function**:
   - Deployer key: For transaction fees
   - Admin key: For privileged operations (if needed)
3. **Use hardware wallets in production**: Consider using Ledger integration

### Authority Management

- Programs are deployed with upgrade authority set to the protocol's authority PDA
- The deployer never holds upgrade authority
- Recovery operations require proper authorization checks

### Binary Security

1. **Validate all binaries** before deployment
2. **Store binary hashes** for audit trails
3. **Implement rate limiting** for deployment operations
4. **Monitor for suspicious patterns** in binary uploads

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

### Integration Tests

```bash
# Start local validator
solana-test-validator

# Deploy protocol (in another terminal)
anchor deploy

# Run integration tests
TEST_INTEGRATION=true npm run test:integration
```

### Manual Testing

```bash
# Use the test script
npx ts-node scripts/test-deployer.ts
```

## Troubleshooting

### Common Issues

#### 1. "Insufficient balance in deployer PDA"
- Ensure the deployer PDA has been funded
- Check that loan principal is transferred correctly

#### 2. "Failed to set deployed program"
- Verify admin keypair has correct permissions
- Check that loan record exists on-chain

#### 3. "Binary validation failed"
- Ensure binary is valid ELF format
- Check size limits
- Verify binary retrieval mechanism

#### 4. "Event not detected"
- Check WebSocket connection
- Verify program ID is correct
- Check transaction commitment level

### Debug Mode

Enable verbose logging:
```bash
LOG_LEVEL=debug npm start
```

### Recovery Procedures

#### Stuck Deployment
```bash
# Kick off the expired-loan recovery sweep against the orchestrator.
# Returns 202 Accepted; check the deployer logs for completion.
curl -X POST http://localhost:3000/v1/jobs/expired-loan-check \
  -H "X-Auth-Pubkey: ..." -H "X-Auth-Timestamp: ..." \
  -H "X-Auth-Nonce: ..." -H "X-Auth-Signature: ..."
```

#### Database Corruption
```bash
# Backup current state
cp -r deployer-state deployer-state.backup

# Rebuild from on-chain data
npm run rebuild-state
```

## API Reference (v1)

The full, machine-readable API contract lives at `/openapi.json` (served by
the running deployer) and is rendered as Swagger UI at `/docs`. The summary
below is the same information in table form for quick lookup.

All v1 endpoints require the `solignition-auth-v1` wallet signature: four
`X-Auth-*` headers per request (Pubkey, Timestamp, Nonce, Signature). See
`deployer/src/auth.ts` for the canonical message format.

### Ops endpoints (unauthenticated, unversioned)

| Method | Path             | Returns                          |
| ------ | ---------------- | -------------------------------- |
| GET    | `/health`        | `{"status":"ok"}`                |
| GET    | `/metrics`       | Prometheus text exposition       |
| GET    | `/openapi.json`  | OpenAPI 3.1 spec for /v1         |
| GET    | `/docs`          | Swagger UI for the spec          |

### v1 endpoints

| Method | Path                                | Purpose                                    | Success status |
| ------ | ----------------------------------- | ------------------------------------------ | --------------- |
| POST   | `/v1/uploads`                       | Upload a Solana program binary (.so)       | 201 + `Location` |
| GET    | `/v1/uploads/:fileId`               | Read an upload by id                       | 200             |
| GET    | `/v1/uploads?borrower=&status=&limit=&offset=` | List uploads (paginated; max 200) | 200 |
| DELETE | `/v1/uploads/:fileId`               | Delete an upload (not allowed once deployed) | 204           |
| POST   | `/v1/loans`                         | Record a new loan-request event            | 201             |
| POST   | `/v1/loans/:loanId/repayments`      | Record a repayment event                   | 201             |
| GET    | `/v1/loans/:loanId/status`          | Aggregated loan-lifecycle status enum      | 200             |
| GET    | `/v1/deployments/:loanId`           | Read deployment by loanId                  | 200             |
| GET    | `/v1/deployments?borrower=&limit=&offset=` | List deployments (paginated; max 200) | 200       |
| POST   | `/v1/jobs/expired-loan-check`       | Kick off the expired-loan recovery sweep   | 202             |

### Status code policy

`200` read · `201` create (+ `Location`) · `202` async job · `204` delete ·
`400` malformed · `401` unauthenticated · `403` authorization mismatch
(`code: "authz_mismatch"`) · `404` missing · `409` conflict (e.g. dup hash) ·
`413` payload too large · `422` schema validation failed · `429` rate limit ·
`500` server error.

### Error envelope

Every error response shares one shape:

```json
{ "error": "human message", "code": "machine_code", "requestId": "uuid" }
```

`code` is stable and machine-readable; `error` is for humans. `requestId`
echoes the `X-Request-Id` header (server-generated if the client didn't
send one) so support tickets can correlate to deployer logs.

## Development Workflow

### Adding New Features

1. Create feature branch
2. Implement with tests
3. Update documentation
4. Run integration tests
5. Submit PR with:
   - Code changes
   - Test coverage
   - Documentation updates

### Release Process

1. Update version in package.json
2. Build and test:
   ```bash
   npm run build
   npm test
   ```
3. Build Docker image:
   ```bash
   docker build -t solana-lending-deployer:vX.Y.Z .
   ```
4. Tag and push:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

## Support

- GitHub Issues: [Report bugs or request features]
- Discord: [Community support]
- Documentation: [Full technical documentation]

## License

[Your License]

## Contributors

[List of contributors]