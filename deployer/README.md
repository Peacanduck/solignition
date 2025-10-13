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

## Monitoring

### Health Endpoints

- `GET /health` - Service health status
- `GET /metrics` - Prometheus metrics
- `GET /deployments/:loanId` - Deployment status

### Metrics

Available Prometheus metrics:
- `deployer_deployments_total` - Total deployments by status
- `deployer_recovery_total` - Total recoveries by status
- `deployer_deployment_duration_seconds` - Deployment operation duration
- `deployer_solana_rpc_errors_total` - RPC error count
- `deployer_active_loans` - Currently active loans

### Grafana Dashboard

Import the provided dashboard JSON:
```bash
cp grafana/dashboard.json /var/lib/grafana/dashboards/
```

Key panels:
- Deployment success rate
- Active loans gauge
- Recovery status
- RPC error rate
- Deployment duration histogram

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
# Manually mark as failed
curl -X POST http://localhost:3000/admin/reset/:loanId
```

#### Database Corruption
```bash
# Backup current state
cp -r deployer-state deployer-state.backup

# Rebuild from on-chain data
npm run rebuild-state
```

## API Reference

### HTTP Endpoints

#### GET /health
Returns service health status.

Response:
```json
{
  "status": "healthy",
  "activeLoans": 5,
  "totalDeployments": 42,
  "timestamp": "2024-01-01T00:00:00Z"
}
```

#### GET /metrics
Returns Prometheus metrics in text format.

#### GET /deployments/:loanId
Returns deployment status for a specific loan.

Response:
```json
{
  "loanId": "123",
  "borrower": "...",
  "programId": "...",
  "status": "deployed",
  "createdAt": 1234567890,
  "updatedAt": 1234567890
}
```

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