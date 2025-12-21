# sn-scriptsync CLI Architecture Documentation

Complete technical documentation for understanding, maintaining, and contributing to the sn-scriptsync CLI tool.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [File Structure](#file-structure)
6. [Key Mechanisms](#key-mechanisms)
7. [Contributing](#contributing)

---

## Overview

The sn-scriptsync CLI is a **standalone WebSocket server** that enables bidirectional synchronization between local files and ServiceNow instances without requiring VS Code. It acts as a bridge between any text editor and the browser extension.

### Design Goals

- ✅ **Editor-agnostic**: Works with Vim, Emacs, Sublime, or any text editor
- ✅ **Standalone**: No VS Code dependency
- ✅ **Real-time sync**: Automatic file watching and synchronization
- ✅ **Zero-configuration**: Uses existing browser extension authentication
- ✅ **Developer-friendly**: Clear logging and error messages

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        User's Workflow                           │
│                                                                   │
│  Edit File in Nvim/Vim/Editor  ──►  Save (:w)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CLI WebSocket Server                           │
│                                                                   │
│  ┌──────────────┐     ┌────────────────┐    ┌───────────────┐  │
│  │ File Watcher │────►│ WebSocketServer│───►│ ScriptSync    │  │
│  │  (chokidar)  │     │                │    │ Server        │  │
│  └──────────────┘     └────────────────┘    └───────────────┘  │
│         │                     ▲                      │           │
│         │ detects change      │ broadcasts           │           │
│         ▼                     │                      ▼           │
│  ┌──────────────┐     ┌────────────────┐    ┌───────────────┐  │
│  │  FileUtils   │     │  Message       │    │  Port 1978    │  │
│  │              │     │  Handlers      │    │  (WebSocket)  │  │
│  └──────────────┘     └────────────────┘    └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ WebSocket Connection
┌─────────────────────────────────────────────────────────────────┐
│                    Browser Extension (SN Utils)                  │
│                                                                   │
│  Receives script updates ────► Authenticates ────► Sends to SN  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼ REST API (authenticated)
┌─────────────────────────────────────────────────────────────────┐
│                       ServiceNow Instance                        │
│                                                                   │
│              Tables: sys_script, sys_script_include, etc.        │
└─────────────────────────────────────────────────────────────────┘
```

### Communication Flow

1. **Editor → File System**: User saves file in any text editor
2. **File System → CLI**: Chokidar detects file change
3. **CLI → Browser Extension**: WebSocket message with script data
4. **Browser Extension → ServiceNow**: Authenticated REST API call
5. **ServiceNow → Browser Extension**: Updated script pulled
6. **Browser Extension → CLI**: WebSocket message with script content
7. **CLI → File System**: File saved to workspace

---

## Core Components

### 1. WebSocketServer.ts

**Purpose**: Manages WebSocket server, client connections, and coordinates all synchronization

**Key Responsibilities**:
- Start/stop WebSocket server on port 1978
- Accept connections from browser extension
- Manage file watcher lifecycle
- Route messages between components
- Handle connection state

**Key Methods**:

```typescript
class ScriptSyncServer {
  // Server lifecycle
  start(): Promise<void>           // Start server and file watcher
  stop(): void                     // Clean shutdown
  
  // Connection management
  setupClientHandlers(ws)          // Setup message handlers
  broadcast(message)               // Send to all connected clients
  getClientCount(): number         // Check active connections
  
  // File operations
  startFileWatcher(): void         // Initialize chokidar watcher
  handleFileChange(filePath)       // Process local file changes
  sendToServiceNow(scriptObj)      // Broadcast to browser extension
  
  // Message handlers
  handleSaveFieldAsFile(message)   // Receive script from ServiceNow
  handleSaveWidget(message)        // Receive widget from ServiceNow
  handleInstanceScope(message)     // Receive scope data
}
```

**Important Properties**:
```typescript
private wss: WSServer | null                 // WebSocket server instance
private fileWatcher: chokidar.FSWatcher      // File system watcher
private lastSave: Map<string, number>        // Debounce tracking
private ignoredFiles: Set<string>            // Prevent sync loops
```

### 2. FileUtils.ts

**Purpose**: File system operations, path parsing, and metadata management

**Key Responsibilities**:
- Parse file paths to ServiceNow objects
- Manage _map.json sys_id mappings
- Handle instance/scope configuration
- Determine file extensions based on field types
- Support both regular and folder-based tables

**Key Methods**:

```typescript
class FileUtils {
  // Path parsing
  filePathToObject(filePath): ScriptObject | boolean
  // Converts: instance/scope/table/name.field.ext
  // Returns: { instance, tableName, name, fieldName, sys_id, content, ... }
  
  // Mapping management
  readMapping(mappingFile): Record<string, string>    // Read _map.json
  writeMapping(mappingFile, mapping): void            // Update _map.json
  
  // File operations
  getFileAsJson(filePath): any                        // Read JSON files
  writeInstanceSettings(instance): void               // Save settings.json
  
  // Type detection
  isFolderRecordTable(tableName): boolean            // Check if sp_widget, etc.
  getFileExtension(fieldType, fieldName): string     // Determine extension
}
```

**File Path Parsing Logic**:
```typescript
// Regular tables (4 parts):
// workspace/instance/scope/table/recordname.field.ext
// Example: ~/sn/dev123/global/sys_script/MyScript.script.js

// Folder tables (5 parts):
// workspace/instance/scope/table/recordname/field.ext
// Example: ~/sn/dev123/global/sp_widget/MyWidget/template.html
```

### 3. ScriptSyncClient.ts

**Purpose**: WebSocket client mode (connects TO VS Code extension server)

**Note**: This is the **original client mode**. For standalone operation, we use `WebSocketServer.ts` instead.

**Difference from WebSocketServer**:
- **ScriptSyncClient**: CLI connects to VS Code extension (client role)
- **WebSocketServer**: CLI hosts server, browser extension connects (server role)

### 4. index.ts

**Purpose**: CLI entry point, command parsing, and command execution

**Available Commands**:

```typescript
// Standalone server mode (NEW!)
sn-scriptsync serve [options]
  --workspace <path>    // Workspace directory
  --port <number>       // WebSocket port (default: 1978)
  --host <string>       // Host address (default: 127.0.0.1)

// Client mode (connects to VS Code)
sn-scriptsync connect [options]
  --workspace <path>
  --port <number>
  --host <string>
```

---

## Data Flow

### Pull: ServiceNow → Local File

```
1. User action in browser extension (clicks "Pull" or uses command)
   ↓
2. Browser extension sends WebSocket message to CLI
   {
     action: 'saveFieldAsFile',
     table: 'sys_script',
     name: 'MyScript',
     field: 'script',
     content: 'gs.info("hello");',
     sys_id: 'abc123...',
     instance: { name: 'dev12345', host: 'https://...' },
     scope: 'global',
     fieldType: 'script'
   }
   ↓
3. CLI receives message → handleSaveFieldAsFile()
   ↓
4. FileUtils determines file path structure
   - Parse scope (global, scoped app, etc.)
   - Clean filename (remove invalid chars)
   - Check/update _map.json for sys_id mapping
   - Determine extension based on fieldType
   ↓
5. File written to disk
   - Create directories if needed (recursive)
   - Write content to file
   - Add to ignoredFiles set (prevent loop!)
   ↓
6. Console output
   "✓ File saved: dev12345/global/sys_script/MyScript.script.js"
```

### Push: Local File → ServiceNow

```
1. User edits file in editor (nvim, vim, etc.)
   ↓
2. User saves file (:w in vim)
   ↓
3. Chokidar detects file change event
   ↓
4. handleFileChange(filePath) called
   ↓
5. Validation checks:
   a) Is file in ignoredFiles? → Skip (just pulled from SN)
   b) Was file changed < 1 second ago? → Debounce
   c) Parse filePath → valid ServiceNow structure?
   d) Does _map.json contain sys_id? → Required!
   e) Is it a helper file (_test_urls)? → Skip
   f) Is it background script? → Skip (run-only)
   ↓
6. FileUtils.filePathToObject(filePath) returns:
   {
     instance: { name: 'dev12345', ... },
     tableName: 'sys_script',
     name: 'MyScript',
     fieldName: 'script',
     sys_id: 'abc123...',
     content: '... new content ...',
     scope: 'global',
     scopeName: 'global'
   }
   ↓
7. sendToServiceNow(scriptObj)
   - Add saveSource: 'CLI'
   - Handle variable fields (variable-xxx → xxx)
   - Broadcast via WebSocket to all clients
   ↓
8. Browser extension receives message
   ↓
9. Browser extension makes authenticated REST API call to ServiceNow
   PUT /api/now/table/sys_script/abc123
   { script: '... new content ...' }
   ↓
10. ServiceNow updates record
   ↓
11. Console output
   "✓ Sent to ServiceNow successfully"
```

---

## File Structure

### Workspace Organization

```
~/Documents/sn-scriptsync/           # Root workspace
│
├── dev12345/                        # Instance name
│   ├── settings.json                # Instance config
│   │   {
│   │     "name": "dev12345",
│   │     "host": "https://dev12345.service-now.com",
│   │     "scope": "global"
│   │   }
│   │
│   ├── scopes.json                  # Scope sys_id mappings
│   │   {
│   │     "global": "global",
│   │     "x_12345_myapp": "abc123def456..."
│   │   }
│   │
│   ├── tablenames.d.ts              # TypeScript definitions
│   ├── properties.d.ts
│   │
│   ├── global/                      # Scope folder
│   │   ├── scope.json               # Scope metadata
│   │   │
│   │   ├── sys_script/              # Table folder
│   │   │   ├── _map.json            # Name → sys_id mapping
│   │   │   │   {
│   │   │   │     "MyScript": "abc123...",
│   │   │   │     "AnotherScript": "def456..."
│   │   │   │   }
│   │   │   ├── MyScript.script.js
│   │   │   └── AnotherScript.script.js
│   │   │
│   │   ├── sys_script_include/
│   │   │   ├── _map.json
│   │   │   └── MyInclude.script.js
│   │   │
│   │   └── sys_ui_action/
│   │       ├── _map.json
│   │       └── MyAction.script.js
│   │
│   └── x_12345_myapp/               # Scoped app
│       └── sys_script/
│           ├── _map.json
│           └── ScopedScript.script.js
│
└── prod54321/                       # Another instance
    └── ...
```

### Special File Types

#### Regular Tables (Most tables)
```
workspace/instance/scope/table/recordname.field.extension

Examples:
- MyScript.script.js         (sys_script.script field)
- MyInclude.script.js        (sys_script_include.script)
- MyRule.condition.js        (sys_script condition field)
- MyRule.script.js           (sys_script script field)
```

#### Folder-Based Tables (sp_widget, sp_header_footer)
```
workspace/instance/scope/table/recordname/field.extension

Example:
sp_widget/MyWidget/
  ├── template.html
  ├── css.scss
  ├── client_script.js
  ├── script.js
  └── link.js
```

---

## Key Mechanisms

### 1. File Watching (chokidar)

**Configuration**:
```typescript
chokidar.watch(workspace, {
  ignored: [
    /(^|[\/\\])\../,         // Dotfiles
    '**/node_modules/**',
    '**/autocomplete/**',
    '**/_map.json',          // Don't trigger on mapping changes
    '**/settings.json',
    '**/scopes.json',
    '**/*.d.ts'
  ],
  persistent: true,
  ignoreInitial: true,        // Don't trigger on startup
  awaitWriteFinish: {
    stabilityThreshold: 300,  // Wait 300ms after last change
    pollInterval: 100         // Check every 100ms
  }
})
```

**Why awaitWriteFinish?**
- Editors like vim may write files in multiple operations
- Prevents triggering on partial writes
- Ensures file is completely written before syncing

**Event Handling**:
```typescript
fileWatcher.on('change', (filePath) => {
  // File modified
  handleFileChange(filePath);
});

fileWatcher.on('error', (error) => {
  // Watch error (permissions, etc.)
});

fileWatcher.on('ready', () => {
  // Initial scan complete
});
```

### 2. Sync Loop Prevention

**Problem**: When CLI saves a file from ServiceNow, the file watcher detects it and tries to send it back!

**Solution**: `ignoredFiles` Set with timeout

```typescript
private ignoredFiles: Set<string> = new Set();

// When saving FROM ServiceNow:
handleSaveFieldAsFile(message) {
  // ... save file ...
  
  // Mark file as ignored
  this.ignoredFiles.add(fileName);
  
  // Remove from ignore list after 2 seconds
  setTimeout(() => this.ignoredFiles.delete(fileName), 2000);
}

// When detecting file change:
handleFileChange(filePath) {
  // Skip if just received from ServiceNow
  if (this.ignoredFiles.has(filePath)) {
    console.log('Skipped: File just received from ServiceNow');
    return;
  }
  // ... continue with sync ...
}
```

**Why 2 seconds?**
- Long enough for file write to complete and trigger watch
- Short enough that user edits aren't blocked
- Handles slow file systems or network drives

### 3. Debouncing

**Problem**: Rapid file saves (e.g., auto-save) cause too many sync operations

**Solution**: Track last save time per file

```typescript
private lastSave: Map<string, number> = new Map();

handleFileChange(filePath) {
  const now = Date.now();
  const lastSaveTime = this.lastSave.get(filePath) || 0;
  
  if (now - lastSaveTime < 1000) {
    console.log('Debounced (too soon)');
    return; // Skip saves within 1 second
  }
  
  this.lastSave.set(filePath, now);
  // ... continue with sync ...
}
```

### 4. sys_id Mapping

**Purpose**: Map human-readable names to ServiceNow sys_ids

**Why needed?**
- File names are human-readable: `MyScript.script.js`
- ServiceNow uses sys_ids to identify records: `abc123def456...`
- Need bidirectional mapping for sync

**File: _map.json**
```json
{
  "MyScript": "abc123def456789",
  "AnotherScript": "def456abc789123",
  "TestScript-AB12": "unique-sys-id-here"
}
```

**Name Collision Handling**:
```typescript
let cleanName = message.name
  .replace(/[^a-z0-9\._\-+]+/gi, '')  // Remove invalid chars
  .replace(/\./g, '-');                // Replace dots

// Check if name already maps to different sys_id
if (nameToSysId[cleanName] && nameToSysId[cleanName] !== message.sys_id) {
  // Add suffix from sys_id to make unique
  cleanName = cleanName + "-" + 
    message.sys_id.slice(0, 2) + 
    message.sys_id.slice(-2).toUpperCase();
}

nameToSysId[cleanName] = message.sys_id;
```

**Example Collision**:
- Two scripts both named "Test Script"
- First saved as: `TestScript.script.js` → sys_id: `abc123...`
- Second saved as: `TestScript-AB23.script.js` → sys_id: `abc234...`

### 5. Path Parsing

**Algorithm** (filePathToObject):

```typescript
function filePathToObject(filePath: string) {
  // 1. Get relative path from workspace
  const relativePath = path.relative(workspace, filePath);
  // "dev12345/global/sys_script/MyScript.script.js"
  
  // 2. Split into parts
  const parts = relativePath.split(path.sep);
  // ["dev12345", "global", "sys_script", "MyScript.script.js"]
  
  // 3. Validate minimum parts
  if (parts.length < 4) return true; // Not a valid synced file
  
  // 4. Extract structure
  const instanceName = parts[0];  // "dev12345"
  const scopeName = parts[1];     // "global"
  const tableName = parts[2];     // "sys_script"
  
  // 5. Load instance settings
  const settings = JSON.parse(
    fs.readFileSync(`${workspace}/${instanceName}/settings.json`)
  );
  
  // 6. Load sys_id mapping
  const mapping = JSON.parse(
    fs.readFileSync(`${workspace}/${instanceName}/${scopeName}/${tableName}/_map.json`)
  );
  
  // 7. Parse filename
  const fileName = path.basename(filePath);
  
  // 8. Check if folder-based table
  if (isFolderRecordTable(tableName)) {
    // sp_widget/MyWidget/template.html
    const recordName = parts[3];           // "MyWidget"
    const [fieldName, ...ext] = fileName.split('.');  // "template", "html"
    
  } else {
    // MyScript.script.js
    const regex = /^(?<recordName>[^.]+)\.(?<fieldName>[^.]+)\.(?<extension>.+)$/;
    const match = regex.exec(fileName);
    // recordName: "MyScript"
    // fieldName: "script"
    // extension: "js"
  }
  
  // 9. Lookup sys_id
  const sys_id = mapping[recordName];
  if (!sys_id) return true; // Not in mapping
  
  // 10. Read file content
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // 11. Return complete object
  return {
    instance: settings,
    tableName,
    name: recordName,
    fieldName,
    sys_id,
    scopeName,
    scope: scopes[scopeName],
    fileName: filePath,
    content
  };
}
```

### 6. Message Protocol

**Client → Server (Browser Extension → CLI)**

```typescript
// Save script to file
{
  action: 'saveFieldAsFile',
  table: 'sys_script',
  name: 'My Script',
  field: 'script',
  content: 'gs.info("hello");',
  sys_id: 'abc123...',
  instance: { name: 'dev12345', host: 'https://...' },
  scope: 'global',
  fieldType: 'script'
}

// Save widget to folder
{
  action: 'saveWidget',
  name: 'My Widget',
  sys_id: 'abc123...',
  fileName: 'template.html',
  content: '<div>...</div>',
  instance: { name: 'dev12345' }
}

// Connection acknowledgment
{
  action: 'setInstanceInfo',
  instance: { name: 'dev12345', host: '...' }
}
```

**Server → Client (CLI → Browser Extension)**

```typescript
// Update script in ServiceNow
{
  instance: { name: 'dev12345', ... },
  tableName: 'sys_script',
  name: 'MyScript',
  fieldName: 'script',
  sys_id: 'abc123...',
  content: '... updated content ...',
  saveSource: 'CLI',
  scope: 'global',
  scopeName: 'global'
}

// Update variable (special case)
{
  // Same as above but:
  fieldName: 'default_value',  // Original: variable-default_value
  action: 'updateVar'           // Special action
}

// Banner message
{
  action: 'bannerMessage',
  message: 'Connected to sn-scriptsync CLI server',
  class: 'alert alert-success'
}
```

---

## Contributing

### Setting Up Development Environment

```bash
# Clone repository
git clone <repo-url>
cd sn-scriptsync/cli

# Install dependencies
npm install

# Build
npm run build

# Watch mode (auto-rebuild on changes)
npm run watch

# Link for testing
npm link

# Test
./test-cli.sh
```

### Project Structure

```
cli/
├── src/
│   ├── index.ts              # CLI entry point, commands
│   ├── WebSocketServer.ts    # Standalone server (NEW!)
│   ├── ScriptSyncClient.ts   # Client mode (original)
│   └── FileUtils.ts          # File operations, parsing
│
├── dist/                     # Compiled JavaScript (gitignored)
├── package.json              # Dependencies, scripts
├── tsconfig.json             # TypeScript configuration
├── test-cli.sh               # Automated tests
│
└── docs/
    ├── README.md             # User guide
    ├── ARCHITECTURE.md       # This file!
    ├── QUICKSTART.md         # Quick start guide
    ├── VIM_INTEGRATION.md    # Vim-specific docs
    └── IMPLEMENTATION.md     # Implementation notes
```

### Adding New Features

#### 1. Add New Message Handler

```typescript
// In WebSocketServer.ts

private setupClientHandlers(ws: WebSocket): void {
  ws.on('message', (data: string) => {
    const message = JSON.parse(data);
    
    if (message?.action === 'newFeature') {
      this.handleNewFeature(message);
    }
    // ... existing handlers ...
  });
}

private handleNewFeature(message: any): void {
  console.log(chalk.blue('← New feature triggered'));
  // Implementation here
}
```

#### 2. Add New CLI Command

```typescript
// In index.ts

program
  .command('new-command')
  .description('Description of new command')
  .option('--option <value>', 'Optional parameter')
  .action(async (options) => {
    console.log('Executing new command');
    // Implementation here
  });
```

#### 3. Add New File Type Support

```typescript
// In FileUtils.ts

const FIELDTYPES: Record<string, { extension: string }> = {
  'script': { extension: '.js' },
  'html': { extension: '.html' },
  // Add new type:
  'python': { extension: '.py' },
};

// Update isFolderRecordTable if needed:
const FOLDERRECORDTABLES = [
  'sp_widget',
  'sp_header_footer',
  'new_folder_table'  // Add new folder-based table
];
```

### Testing

```bash
# Run automated tests
./test-cli.sh

# Manual testing
node dist/index.js serve --workspace /tmp/test-workspace

# Debug with verbose logging
DEBUG=* node dist/index.js serve
```

### Debugging Tips

**Enable TypeScript source maps**:
```json
// tsconfig.json
{
  "compilerOptions": {
    "sourceMap": true
  }
}
```

**Add debug logging**:
```typescript
import chalk from 'chalk';

console.log(chalk.gray('[DEBUG]'), 'Variable value:', myVar);
console.log(chalk.yellow('[WARN]'), 'Something unusual');
console.log(chalk.red('[ERROR]'), 'Something failed');
```

**Inspect WebSocket messages**:
```typescript
ws.on('message', (data: string) => {
  console.log(chalk.magenta('← RAW MESSAGE:'), data);
  const message = JSON.parse(data);
  // ...
});
```

### Common Issues & Solutions

**Issue**: File changes not detected
- Check: File is not in ignored patterns
- Check: awaitWriteFinish timeout may be too short
- Check: File path matches expected structure

**Issue**: Sync loop (files bouncing back and forth)
- Check: ignoredFiles Set is working
- Check: Timeout duration (2 seconds) is sufficient

**Issue**: sys_id not found
- Check: _map.json exists and is valid JSON
- Check: File was pulled from ServiceNow first
- Solution: Add manual mapping to _map.json

**Issue**: ACL errors
- Check: Browser extension scope matches record scope
- Check: User has write permissions in ServiceNow
- Solution: Switch scope in browser extension

---

## Future Enhancements

### Planned Features

1. **Background Script Execution**
   - Run background scripts from CLI
   - Stream output to console
   - Save output to file

2. **Bulk Operations**
   - Pull entire application scopes
   - Push multiple files at once
   - Conflict resolution

3. **Git Integration**
   - Auto-commit on successful sync
   - Branch-based workflows
   - Merge conflict detection

4. **Enhanced Error Handling**
   - Retry failed syncs
   - Queue messages when disconnected
   - Better error messages with suggested fixes

5. **Configuration File**
   - .snrc file for preferences
   - Custom ignore patterns
   - Workspace profiles

6. **Performance Optimizations**
   - Batch file changes
   - Smart diffing (only send changed lines)
   - Compression for large files

### Contributing Guidelines

1. **Code Style**
   - Use TypeScript
   - Follow existing patterns
   - Add comments for complex logic
   - Use chalk for colored console output

2. **Error Handling**
   - Always handle promises with try/catch
   - Provide helpful error messages
   - Log errors with context

3. **Testing**
   - Add tests for new features
   - Update test-cli.sh
   - Test with multiple editors

4. **Documentation**
   - Update this file for architectural changes
   - Update README.md for user-facing changes
   - Add code comments for complex algorithms

---

## Resources

### Related Documentation

- [README.md](./README.md) - User guide and usage
- [QUICKSTART.md](./QUICKSTART.md) - Quick start guide
- [VIM_INTEGRATION.md](./VIM_INTEGRATION.md) - Vim-specific integration
- [IMPLEMENTATION.md](./IMPLEMENTATION.md) - Implementation notes

### External Dependencies

- **[chokidar](https://github.com/paulmillr/chokidar)** - File watching
- **[ws](https://github.com/websockets/ws)** - WebSocket server/client
- **[chalk](https://github.com/chalk/chalk)** - Terminal colors
- **[commander](https://github.com/tj/commander.js)** - CLI framework

### ServiceNow APIs

- [Table API](https://docs.servicenow.com/bundle/tokyo-api-reference/page/integrate/inbound-rest/concept/c_TableAPI.html)
- [Scripting APIs](https://docs.servicenow.com/bundle/tokyo-api-reference/page/app-store/dev_portal/API_reference/scripting-apis/concept/scripting-apis.html)

---

## Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Check existing documentation
- Review code comments

---

**Last Updated**: December 22, 2025
**Version**: 1.0.0
**Author**: sn-scriptsync contributors
