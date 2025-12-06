# sn-scriptsync CLI

Command-line interface for ServiceNow script synchronization via the browser extension.

## Overview

The `sn-scriptsync` CLI allows you to sync ServiceNow scripts from the command line, enabling integration with any text editor (Vim, Emacs, Sublime, etc.) while leveraging the browser extension for authentication and communication with ServiceNow.

## Architecture

```
┌─────────────────┐      WebSocket      ┌──────────────────┐
│   CLI Tool      │◄────────────────────►│  Browser Ext.    │
│   (Any Editor)  │      Port 1978       │  (SN Utils)      │
└─────────────────┘                      └──────────────────┘
         │                                        │
         │ File System                            │ REST API
         │ (Read/Write)                           │
         ▼                                        ▼
┌─────────────────┐                      ┌──────────────────┐
│  Local Files    │                      │   ServiceNow     │
│  ~/workspace    │                      │   Instance       │
└─────────────────┘                      └──────────────────┘
```

## Features

- ✅ Connect to browser extension WebSocket server
- ✅ Receive code from ServiceNow (when VSCode is not running)
- ✅ Send code changes to ServiceNow automatically
- ✅ File watcher for automatic synchronization
- ✅ Pull scope artifacts from ServiceNow
- ✅ Load instance metadata
- ✅ Open files in ServiceNow instance
- ✅ Refresh files from instance
- ✅ Works with any text editor

## Installation

### Prerequisites

1. Install the SN Utils browser extension
2. Have a ServiceNow instance with the browser extension configured
3. Node.js 16+ installed

### Install CLI

```bash
cd cli
npm install
npm run build
npm link  # Makes 'sn-scriptsync' command available globally
```

## Usage

### 1. Connect and Watch for Changes

Start the CLI in your workspace directory:

```bash
# Navigate to your scriptsync workspace
cd ~/Documents/sn-scriptsync

# Start the CLI (connects to browser extension and watches files)
sn-scriptsync connect

# Or specify custom options
sn-scriptsync connect --port 1978 --host 127.0.0.1 --workspace /path/to/workspace
```

This will:
- Connect to the browser extension WebSocket server (port 1978)
- Watch for file changes in your workspace
- Automatically sync changes to ServiceNow
- Receive new code from ServiceNow (even when VSCode is not running)

### 2. Check Connection Status

```bash
sn-scriptsync status
```

### 3. Pull Scope Artifacts

Load all artifacts from your current scope:

```bash
# Basic pull
sn-scriptsync pull

# Include empty artifacts
sn-scriptsync pull --all
```

### 4. Load Instance Metadata

Download table names and properties for IntelliSense:

```bash
sn-scriptsync metadata
```

### 5. Open File in Instance

Open a synced file in the ServiceNow instance:

```bash
sn-scriptsync open path/to/file.script.js
```

### 6. Refresh File from Instance

Pull the latest version of a file from ServiceNow:

```bash
sn-scriptsync refresh path/to/file.script.js
```

## Browser Extension Functions Mapped to CLI

| VSCode Extension Function | CLI Command/Feature | Description |
|---------------------------|---------------------|-------------|
| `startServers()` | `sn-scriptsync connect` | Start WebSocket client |
| `saveFieldAsFile()` | Automatic (via WebSocket) | Receive code from browser |
| `saveFieldsToServiceNow()` | Automatic (via file watcher) | Send code to ServiceNow |
| `saveWidget()` | Automatic (via WebSocket) | Receive widget data |
| `requestScopeArtifacts()` | `sn-scriptsync pull` | Load scope artifacts |
| `requestInstanceMetaData()` | `sn-scriptsync metadata` | Load instance metadata |
| `openInInstance()` | `sn-scriptsync open <file>` | Open file in instance |
| `refreshFromInstance()` | `sn-scriptsync refresh <file>` | Refresh file from instance |

## Workflow Examples

### Typical Workflow

1. **Initial Setup** (one-time):
   ```bash
   # Open browser extension and run /token command
   # This establishes the connection
   
   # Start CLI in workspace
   cd ~/Documents/sn-scriptsync
   sn-scriptsync connect
   ```

2. **Pull Existing Scripts**:
   ```bash
   # In another terminal (or before connecting)
   sn-scriptsync pull --all
   ```

3. **Edit with Your Favorite Editor**:
   ```bash
   # Use Vim, Emacs, Sublime, or any editor
   vim instance-name/global/sys_script/MyBusinessRule.script.js
   
   # Changes are automatically synced to ServiceNow!
   ```

4. **Open in Browser** (when you need to check the UI):
   ```bash
   sn-scriptsync open instance-name/global/sys_script/MyBusinessRule.script.js
   ```

### Using with Vim

```bash
# Terminal 1: Start CLI
sn-scriptsync connect

# Terminal 2: Edit files
cd ~/Documents/sn-scriptsync/instance-name
vim global/sys_script/MyBusinessRule.script.js
```

Every time you save in Vim (`:w`), the CLI automatically syncs to ServiceNow.

### Using with Multiple Editors

The CLI works with any editor that writes to the filesystem:
- Vim/Neovim
- Emacs
- Sublime Text
- Atom
- Nano
- Even `sed` or `awk` scripts!

## File Structure

The CLI uses the same file structure as the VSCode extension:

```
workspace/
├── instance-name/
│   ├── settings.json          # Instance configuration
│   ├── scopes.json            # Scope mappings
│   ├── tablenames.d.ts        # Table names for IntelliSense
│   ├── properties.d.ts        # Properties for IntelliSense
│   └── scope-name/
│       ├── scope.json         # Scope metadata
│       └── table-name/
│           ├── _map.json      # Name to sys_id mapping
│           ├── record1.script.js
│           ├── record2.script.js
│           └── widget-name/   # For widgets
│               ├── template.html
│               ├── css.scss
│               ├── client_script.js
│               └── script.js
```

## Configuration

The CLI reads configuration from the existing instance settings created by the browser extension. No additional configuration is needed.

## Troubleshooting

### "No WebSocket connection" Error

Make sure:
1. The browser extension is installed and active
2. You've run the `/token` command in your ServiceNow instance
3. The helper tab is open in your browser
4. Port 1978 is not blocked by a firewall

### Files Not Syncing

1. Check that you're in the correct workspace directory
2. Verify the file follows the correct naming pattern: `name.field.extension`
3. Check the `_map.json` file exists and contains the sys_id mapping

### "Not a valid synced file" Error

This means the file doesn't follow the expected structure or doesn't have a sys_id mapping. Pull the file from ServiceNow first using the browser extension or `sn-scriptsync pull`.

## Advanced Usage

### Custom Port

If you're running multiple instances:

```bash
sn-scriptsync connect --port 1979 --workspace /path/to/workspace2
```

### Scripting

Integrate with shell scripts:

```bash
#!/bin/bash
# Pull latest, edit, and open in browser

sn-scriptsync pull
vim instance/global/sys_script/MyScript.script.js
sn-scriptsync open instance/global/sys_script/MyScript.script.js
```

## Comparison with VSCode Extension

| Feature | VSCode Extension | CLI Tool |
|---------|------------------|----------|
| Code Sync | ✅ | ✅ |
| File Watching | ✅ | ✅ |
| Browser Communication | ✅ WebSocket Server | ✅ WebSocket Client |
| Editor | VSCode only | Any editor |
| Tree View | ✅ | ❌ (use filesystem) |
| IntelliSense | ✅ | ❌ (editor-dependent) |
| Background Scripts | ✅ | ✅ (future) |

## Next Steps

See [VIM_INTEGRATION.md](./VIM_INTEGRATION.md) for Vim-specific integration patterns and recommendations.
