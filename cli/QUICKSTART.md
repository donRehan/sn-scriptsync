# Quick Start Guide: CLI Standalone Mode

## Summary

**You can now use the CLI tool WITHOUT VS Code!** The CLI can run its own WebSocket server that connects directly to the browser extension.

## What Was Changed

- ✅ Added standalone WebSocket server to CLI (`WebSocketServer.ts`)
- ✅ Added `serve` command to start the server
- ✅ Server handles all browser extension communication
- ✅ Works with ANY text editor (vim, emacs, sublime, etc.)
- ✅ Maintains same file structure as VS Code extension

## Test the CLI (Verify It Works)

```bash
cd /home/donrehan/sandbox/sn-scriptsync/cli
./test-cli.sh
```

Expected output:
```
======================================
✓ All tests passed!
======================================
```

## Use CLI with Browser Extension

### Step 1: Start the CLI Server

```bash
cd /home/donrehan/sandbox/sn-scriptsync/cli

# Build (first time only)
npm install
npm run build

# Start server
node dist/index.js serve --workspace ~/Documents/sn-scriptsync
```

You should see:
```
✓ WebSocket server started on 127.0.0.1:1978
  Waiting for browser extension connection...
Server is running. Press Ctrl+C to stop.
Open browser extension and run /token to connect
```

### Step 2: Connect Browser Extension

1. Open your ServiceNow instance in browser
2. Make sure SN Utils browser extension is installed
3. Run `/token` command in ServiceNow
4. Browser extension will connect to CLI server

You should see in CLI:
```
← Connection attempt from: chrome-extension://...
✓ Connection accepted
  Instance: dev12345 (https://dev12345.service-now.com)
```

### Step 3: Pull Scripts

Use the browser extension UI to pull scripts from your scope. The CLI server will save them to your workspace.

You'll see output like:
```
← Receiving file from ServiceNow
  Table: sys_script_include, Name: MyScriptInclude
✓ File saved: dev12345/global/sys_script_include/MyScriptInclude.script.js
```

### Step 4: Edit Files

Now edit files with your preferred editor:

```bash
# Vim
vim ~/Documents/sn-scriptsync/dev12345/global/sys_script_include/MyScriptInclude.script.js

# VS Code (from terminal, no extension needed!)
code ~/Documents/sn-scriptsync/dev12345/global/sys_script_include/MyScriptInclude.script.js

# Emacs
emacs ~/Documents/sn-scriptsync/dev12345/global/sys_script_include/MyScriptInclude.script.js

# Any editor!
```

Changes are automatically synced back to ServiceNow via the browser extension.

## Available Commands

### `serve` - Start Standalone Server (NEW!)
```bash
sn-scriptsync serve [options]

Options:
  -p, --port <port>         WebSocket port (default: 1978)
  -h, --host <host>         WebSocket host (default: 127.0.0.1)
  -w, --workspace <path>    Workspace path (default: current directory)
```

### `status` - Check Connection
```bash
sn-scriptsync status
```

### `connect` - Connect as Client
Use this if VS Code extension is running the server:
```bash
sn-scriptsync connect --workspace ~/Documents/sn-scriptsync
```

## Architecture

### Before (Required VS Code):
```
Browser Extension ──┐
                    ├──► VS Code Extension (WebSocket Server)
CLI Tool ───────────┘
```

### After (Standalone CLI):
```
Browser Extension ──► CLI Server ──► File System
                                      (Any Editor!)
```

## Troubleshooting

### Port Already in Use

```bash
# Check what's using port 1978
lsof -i :1978

# Use different port
sn-scriptsync serve --port 1979
```

Then update browser extension settings to use port 1979.

### Connection Refused

Make sure:
1. CLI server is running: `sn-scriptsync serve`
2. Browser extension is active
3. You've run `/token` in ServiceNow  
4. No firewall blocking localhost:1978

### Files Not Syncing

1. Check server console for errors
2. Run `/token` again in ServiceNow
3. Verify workspace path is correct
4. Check file is in correct directory structure

## Benefits

✅ **Use ANY editor** - vim, emacs, sublime, atom, etc.
✅ **No VS Code required** - Lighter weight
✅ **Same functionality** - All features work
✅ **Same file structure** - Compatible with VS Code extension
✅ **Better for remote** - Can run on servers
✅ **Multiple instances** - Run multiple CLI servers on different ports

## Next Steps

1. **Run the test**: `./test-cli.sh` to verify everything works
2. **Start the server**: `node dist/index.js serve`
3. **Connect browser**: Run `/token` in ServiceNow
4. **Start coding**: Edit files with your favorite editor!

## Need Help?

- Check `IMPLEMENTATION.md` for technical details
- Run `sn-scriptsync --help` for command list
- Run `sn-scriptsync <command> --help` for command details
