#!/bin/bash

echo "Starting VidGrid dev environment..."

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $ANVIL_PID $SERVER_PID 2>/dev/null
  exit 0
}
trap cleanup SIGTERM SIGINT

# Start anvil (local chain)
anvil &
ANVIL_PID=$!
sleep 2

# Deploy contracts (if forge project exists)
if [ -f apps/contracts/script/Deploy.s.sol ]; then
  echo "Deploying contracts..."
  cd apps/contracts && forge script script/Deploy.s.sol --rpc-url http://localhost:8545 --broadcast
  cd ../..
fi

# Start server
cd apps/server && npx tsx src/index.ts &
SERVER_PID=$!
cd ../..

echo ""
echo "VidGrid running:"
echo "  Anvil:  PID=$ANVIL_PID (localhost:8545)"
echo "  Server: PID=$SERVER_PID (localhost:3001)"
echo ""
echo "Press Ctrl+C to stop"
wait
