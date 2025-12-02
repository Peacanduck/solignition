module.exports = {
  apps : [{
    name: "deployer",
    script: "/home/ubuntu/solignition/deployer/dist/deployer/src/index.js",
    env: {
      NODE_ENV: "development",
    },
    env_production: {
      NODE_ENV: "production",
      RPC_URL:"https://api.devnet.solana.com",
      WS_URL:"",
      PROGRAM_ID:"4dWBvsjopo5Z145Xmse3Lx41G1GKpMyWMLc6p4a52T4N",
      CLUSTER:"devnet",
      DEPLOYER_KEYPAIR_PATH:"/home/ubuntu/solignition/deployer/deployerKey.json",
      ADMIN_KEYPAIR_PATH:"/home/ubuntu/solignition/deployer/deployerKey.json",
      BINARY_STORAGE_PATH:"./binaries",
      DB_PATH:"./deployer-state",
      UPLOAD_PATH:"./uploads",
      PORT:"3000",
      LOG_LEVEL:"info",
      MAX_RETRIES:"3",
      RETRY_DELAY_MS:"5000",
      POLL_INTERVAL_MS:"30000",
      IDL_PATH:"/home/ubuntu/solignition/anchor/target/idl/solignition.json",
      IDL_PATHTS:"/home/ubuntu/solignition/anchor/target/types/solignition.ts",
      GRAPHQL_ENDPOINT:"http://127.0.0.1:18488/workspace/v1/graphql",
      FRONTEND_URL:"https://app.solignition.xyz/",
      API_KEY_HEADER:"X-API-Key",
      CORS_ORIGINS:"https://app.solignition.xyz/",
    }
  }]
}