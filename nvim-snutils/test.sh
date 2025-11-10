#!/bin/bash

# Test script for nvim-snutils
echo "Building TypeScript..."
npm run build

echo "Testing download with sys_id: 595a20fac7211010ed6cdd34f2c2602c"
node js/sn-bridge.js download --instance https://dev355738.service-now.com --username admin --password "dfM/BY9Z@6yy" sys_script 595a20fac7211010ed6cdd34f2c2602c script

echo "Test completed. Check for downloaded files in dev355738.service-now.com/ directory"