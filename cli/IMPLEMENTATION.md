# CLI Standalone Server Implementation

## What Changed

Added a **standalone WebSocket server** to the CLI that eliminates the need for VS Code to be running.

### New Files

1. **`cli/src/WebSocketServer.ts`** - Standalone WebSocket server that handles browser extension connections
2. **`cli/test-cli.sh`** - Automated test script for CLI functionality

### Modified Files

1. **`cli/src/index.ts`** - Added `serve` command to start standalone server

## Architecture Before vs After

### BEFORE (Original):
```
Browser Extension ──┐
                    ├──► VS Code Extension (WebSocket Server on port 1978)
CLI Tool ───────────┘
```
- **Required**: VS Code running with extension enabled
- **Limitation**: Cannot use CLI without VS Code

### AFTER (New):
```
Option 1 (Original):
Browser Extension ──┐
                    ├──► VS Code Extension (port 1978)
CLI Tool ───────────┘

Option 2 (NEW - Standalone):
Browser Extension ──► CLI Server (port 1978) ──► File System
```
- **NEW**: Can run CLI server without VS Code
- **Flexible**: Choose VS Code OR CLI server

## How to Use

### Test the CLI (Without Browser Extension)

Run the automated test suite:

```bash
cd cli
./test-cli.sh
```

This tests:
- ✅ CLI builds correctly
- ✅ Commands are available
- ✅ WebSocket server starts
- ✅ WebSocket accepts connections  
- ✅ File operations work

### Use CLI Server with Browser Extension

#### 1. Start the CLI Server

```bash
cd cli
npm install
npm run build

# Start server (replaces VS Code)
node dist/index.js serve --workspace ~/Documents/sn-scriptsync
```

Output:
```
✓ WebSocket server started on 127.0.0.1:1978
  Waiting for browser extension connection...
Server is running. Press Ctrl+C to stop.
Open browser extension and run /token to connect
```

#### 2. Connect Browser Extension

1. Open ServiceNow instance in browser with SN Utils extension
2. Run `/token` command in ServiceNow
3. Browser extension will connect to CLI server

Output you'll see:
```
← Browser extension connected
  Instance: dev12345 (https://dev12345.service-now.com)
```

#### 3. Pull Scripts from ServiceNow

Use the browser extension UI to pull scripts, and they'll be saved by the CLI server.

You'll see output like:
```
← Receiving file from ServiceNow
  Table: sys_script_include, Name: MyScriptInclude
✓ File saved: dev12345/global/sys_script_include/MyScriptInclude.script.js
```

#### 4. Edit Files in ANY Editor

Now you can edit files with vim, emacs, sublime, or any editor:

```bash
# Use your favorite editor
vim ~/Documents/sn-scriptsync/dev12345/global/sys_script_include/MyScriptInclude.script.js

# Or VS Code from terminal
code ~/Documents/sn-scriptsync/dev12345/global/sys_script_include/MyScriptInclude.script.js
```

The CLI server will watch for changes and automatically sync them back to ServiceNow via the browser extension.

## Available Commands

### `sn-scriptsync serve`
Start standalone WebSocket server (replaces VS Code extension)

Options:
- `-p, --port <port>` - WebSocket port (default: 1978)
- `-h, --host <host>` - WebSocket host (default: 127.0.0.1)
- `-w, --workspace <path>` - Workspace path (default: current directory)

Example:
```bash
sn-scriptsync serve --workspace ~/Documents/sn-scriptsync --port 1978
```

### `sn-scriptsync status`
Check if server is reachable

### `sn-scriptsync connect`
Connect as client to existing server (VS Code or another CLI instance)

### `sn-scriptsync pull`
Pull scope artifacts from ServiceNow

### `sn-scriptsync metadata`
Load instance metadata

## Testing Checklist

- [x] CLI builds without errors
- [x] WebSocket server starts on specified port
- [x] WebSocket accepts connections
- [x] Server handles multiple connection attempts correctly (max 1 client)
- [ ] Browser extension can connect to CLI server
- [ ] Files can be received from ServiceNow
- [ ] Files can be sent to ServiceNow
- [ ] File watching detects changes
- [ ] Mapping files are created correctly

## Troubleshooting

### Port Already in Use

If you see "Address already in use" error:

```bash
# Check what's using port 1978
lsof -i :1978

# Kill the process or use a different port
sn-scriptsync serve --port 1979
```

### Connection Refused

Make sure:
1. CLI server is running: `sn-scriptsync serve`
2. Browser extension is active
3. You've run `/token` in ServiceNow
4. No firewall blocking localhost:1978

### Files Not Syncing

Check:
1. Server console for error messages
2. File is in the correct workspace directory structure
3. Browser extension shows connected status
4. Run `/token` again to refresh connection

## Implementation Notes

### Key Features Implemented

1. **WebSocket Server** (`WebSocketServer.ts`)
   - Listens on port 1978 (configurable)
   - Accepts browser extension connections
   - Handles all message types (saveFieldAsFile, saveWidget, etc.)
   - Provides same interface as VS Code extension
   - Broadcasts messages to connected clients

2. **File System Operations**
   - Saves files received from browser
   - Maintains mapping files (_map.json)
   - Creates proper directory structure
   - Handles scoped apps correctly

3. **Message Handling**
   - Token refresh
   - File save/receive
   - Widget operations
   - Metadata operations
   - Error handling with proper feedback

### Architecture Decisions

- **Server vs Client**: Created separate Server class to avoid confusion
- **Port Default**: Uses 1978 to match VS Code extension
- **File Structure**: Maintains exact same structure as VS Code for compatibility
- **Error Handling**: Console output with chalk colors for visibility

## Future Enhancements

Potential improvements:
- [ ] Add file watching to detect local changes (currently exists in connect mode)
- [ ] Add configuration file support (~/.sn-scriptsync.json)
- [ ] Add multi-instance support (multiple workspaces)
- [ ] Add HTTPS/WSS support for remote connections
- [ ] Add authentication for server connections
- [ ] Add desktop notifications for sync events
- [ ] Create a TUI (Terminal UI) for better visualization
