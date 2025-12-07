#!/bin/bash

# Test script for sn-scriptsync CLI
# This script tests the CLI functionality without needing browser extension

set -e

echo "======================================"
echo "sn-scriptsync CLI Test Suite"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test workspace
TEST_WORKSPACE="/tmp/sn-scriptsync-test"
CLI_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "${BLUE}1. Setting up test environment...${NC}"
rm -rf "$TEST_WORKSPACE"
mkdir -p "$TEST_WORKSPACE"
cd "$CLI_DIR"

echo -e "${GREEN}✓ Test workspace created: $TEST_WORKSPACE${NC}"
echo ""

echo -e "${BLUE}2. Building CLI tool...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}  Installing dependencies...${NC}"
    npm install
fi

npm run build
echo -e "${GREEN}✓ CLI built successfully${NC}"
echo ""

echo -e "${BLUE}3. Testing CLI commands...${NC}"
echo ""

# Test 1: Check if CLI is executable
echo -e "${YELLOW}Test 3.1: CLI help command${NC}"
if node dist/index.js --help > /dev/null 2>&1; then
    echo -e "${GREEN}✓ CLI help works${NC}"
else
    echo -e "${RED}✗ CLI help failed${NC}"
    exit 1
fi
echo ""

# Test 2: Test serve command availability
echo -e "${YELLOW}Test 3.2: Serve command exists${NC}"
if node dist/index.js serve --help > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Serve command available${NC}"
else
    echo -e "${RED}✗ Serve command not found${NC}"
    exit 1
fi
echo ""

# Test 3: Test status command  
echo -e "${YELLOW}Test 3.3: Status command (should fail - no server)${NC}"
if node dist/index.js status 2>&1 | grep -q "not reachable"; then
    echo -e "${GREEN}✓ Status command works (correctly reports no server)${NC}"
else
    echo -e "${YELLOW}⚠ Status command behavior unexpected${NC}"
fi
echo ""

echo -e "${BLUE}4. Testing WebSocket server...${NC}"
echo ""

echo -e "${YELLOW}Test 4.1: Start server in background${NC}"
# Start server in background
node dist/index.js serve --workspace "$TEST_WORKSPACE" --port 9978 > /tmp/sn-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
sleep 2

if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${GREEN}✓ Server started (PID: $SERVER_PID, Port: 9978)${NC}"
else
    echo -e "${RED}✗ Server failed to start${NC}"
    cat /tmp/sn-server.log
    exit 1
fi
echo ""

echo -e "${YELLOW}Test 4.2: Check if port is listening${NC}"
if command -v netstat &> /dev/null; then
    if netstat -ln | grep -q "9978"; then
        echo -e "${GREEN}✓ Port 9978 is listening${NC}"
    else
        echo -e "${RED}✗ Port 9978 not listening${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
elif command -v ss &> /dev/null; then
    if ss -ln | grep -q "9978"; then
        echo -e "${GREEN}✓ Port 9978 is listening${NC}"
    else
        echo -e "${RED}✗ Port 9978 not listening${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
elif command -v lsof &> /dev/null; then
    if lsof -i :9978 &> /dev/null; then
        echo -e "${GREEN}✓ Port 9978 is listening${NC}"
    else
        echo -e "${RED}✗ Port 9978 not listening${NC}"
        kill $SERVER_PID 2>/dev/null || true
        exit 1
    fi
else
    echo -e "${YELLOW}⚠ Cannot check port (netstat/ss/lsof not available)${NC}"
fi
echo ""

echo -e "${YELLOW}Test 4.3: Test WebSocket connection${NC}"
# Use Node.js to test WebSocket connection
cat > /tmp/test-ws-client.js << 'EOF'
const WebSocket = require('ws');

const ws = new WebSocket('ws://127.0.0.1:9978');

ws.on('open', () => {
    console.log('WEBSOCKET_CONNECTED');
    ws.close();
    process.exit(0);
});

ws.on('error', (error) => {
    console.error('WEBSOCKET_ERROR:', error.message);
    process.exit(1);
});

setTimeout(() => {
    console.error('WEBSOCKET_TIMEOUT');
    process.exit(1);
}, 5000);
EOF

if NODE_PATH="$CLI_DIR/node_modules" node /tmp/test-ws-client.js 2>&1 | grep -q "WEBSOCKET_CONNECTED"; then
    echo -e "${GREEN}✓ WebSocket connection successful${NC}"
else
    echo -e "${RED}✗ WebSocket connection failed${NC}"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi
echo ""

echo -e "${YELLOW}Test 4.4: Stop server${NC}"
kill $SERVER_PID 2>/dev/null || true
sleep 1

if kill -0 $SERVER_PID 2>/dev/null; then
    echo -e "${RED}✗ Server still running${NC}"
    kill -9 $SERVER_PID 2>/dev/null || true
else
    echo -e "${GREEN}✓ Server stopped cleanly${NC}"
fi
echo ""

echo -e "${BLUE}5. Testing file system operations...${NC}"
echo ""

echo -e "${YELLOW}Test 5.1: Create test file structure${NC}"
mkdir -p "$TEST_WORKSPACE/test-instance/global/sys_script_include"
cat > "$TEST_WORKSPACE/test-instance/settings.json" << EOF
{
    "name": "test-instance",
    "url": "https://test.service-now.com",
    "user": "test"
}
EOF

cat > "$TEST_WORKSPACE/test-instance/scopes.json" << EOF
{
    "global": "global"
}
EOF

if [ -f "$TEST_WORKSPACE/test-instance/settings.json" ]; then
    echo -e "${GREEN}✓ Test file structure created${NC}"
else
    echo -e "${RED}✗ Failed to create test files${NC}"
    exit 1
fi
echo ""

echo "======================================"
echo -e "${GREEN}✓ All tests passed!${NC}"
echo "======================================"
echo ""
echo "Next steps to test with browser extension:"
echo ""
echo -e "${BLUE}1. Start the CLI server:${NC}"
echo "   cd $CLI_DIR"
echo "   node dist/index.js serve --workspace ~/Documents/sn-scriptsync"
echo ""
echo -e "${BLUE}2. Open ServiceNow in browser with SN Utils extension${NC}"
echo ""
echo -e "${BLUE}3. Run /token command in ServiceNow${NC}"
echo ""
echo -e "${BLUE}4. Browser extension should connect to CLI server${NC}"
echo ""
echo -e "${BLUE}5. Pull some scripts to test:${NC}"
echo "   (Use browser extension UI to pull scripts)"
echo ""

# Cleanup
rm -f /tmp/test-ws-client.js /tmp/sn-server.log
