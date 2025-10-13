# Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src
COPY idl.json ./

# Build the application
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production && \
    npm cache clean --force

# Copy built application and IDL
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/idl.json ./
COPY --chown=nodejs:nodejs . .

# Create necessary directories
RUN mkdir -p /app/binaries /app/deployer-state && \
    chown -R nodejs:nodejs /app

USER nodejs

EXPOSE 3000

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]

---

# docker-compose.yml
version: '3.8'

services:
  deployer:
    build: .
    container_name: solana-lending-deployer
    restart: unless-stopped
    env_file:
      - .env
    volumes:
      - ./binaries:/app/binaries
      - ./deployer-state:/app/deployer-state
      - ./keys:/app/keys:ro
    ports:
      - "3000:3000"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    networks:
      - solana-network
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    networks:
      - solana-network
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3001:3000"
    networks:
      - solana-network
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_INSTALL_PLUGINS=grafana-piechart-panel

networks:
  solana-network:
    driver: bridge

volumes:
  prometheus_data:
  grafana_data:

---

# .env.example
# Solana Configuration
RPC_URL=https://api.devnet.solana.com
WS_URL=wss://api.devnet.solana.com
CLUSTER=devnet

# Program Configuration  
PROGRAM_ID=4dWBvsjopo5Z145Xmse3Lx41G1GKpMyWMLc6p4a52T4N

# Keypair Paths (inside container or absolute paths)
DEPLOYER_KEYPAIR_PATH=/app/keys/deployer-keypair.json
ADMIN_KEYPAIR_PATH=/app/keys/admin-keypair.json

# Storage Paths
BINARY_STORAGE_PATH=/app/binaries
DB_PATH=/app/deployer-state

# Service Configuration
PORT=3000
LOG_LEVEL=info

# Retry Configuration
MAX_RETRIES=3
RETRY_DELAY_MS=5000
POLL_INTERVAL_MS=30000

---

# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'solana-deployer'
    static_configs:
      - targets: ['deployer:3000']
    metrics_path: '/metrics'

---

# tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}

---

# .dockerignore
node_modules
dist
.git
.gitignore
README.md
.env
deployer-state
binaries
*.log
.DS_Store
coverage
.nyc_output
jest.config.js
**/*.test.ts
**/*.test.js