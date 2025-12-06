# Browser Extension Functions Mapping

This document maps all browser extension communication functions from the VSCode extension to the CLI implementation.

## Architecture Overview

### VSCode Extension (Server)
- Runs WebSocket **server** on port 1978
- Listens for connections from browser extension
- Handles file system operations
- Watches for file changes

### CLI Tool (Client)
- Runs WebSocket **client** connecting to port 1978
- Can run when VSCode is not running
- Receives code from browser extension
- Sends code to ServiceNow
- Watches for file changes

### Browser Extension
- Communicates with ServiceNow REST API
- Acts as authentication bridge
- Connects to WebSocket (server or client)

## Function Mapping

### 1. Connection Management

#### VSCode Extension
```typescript
// File: src/extension.ts
function startServers() {
  wss = new WebSocket.Server({ port: 1978, host: '127.0.0.1' });
  wss.on('connection', (ws, req) => {
    // Handle incoming connections
  });
}

function stopServers() {
  wss.close();
}
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
async connect(): Promise<void> {
  const url = `ws://${this.host}:${this.port}`;
  this.ws = new WebSocket(url);
  // Connect as client to existing server
}

disconnect(): void {
  if (this.ws) {
    this.ws.close();
  }
}
```

**Status**: ✅ Implemented

---

### 2. Receive Code from Browser Extension

#### VSCode Extension
```typescript
// File: src/extension.ts
function saveFieldAsFile(postedJson, retry = 0) {
  // Receives code from browser and saves to filesystem
  // Creates directory structure
  // Updates _map.json mapping
  // Writes file content
}
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
private handleSaveFieldAsFile(message: any): void {
  // Same logic as VSCode extension
  // Receives code from browser via WebSocket
  // Saves to filesystem with proper structure
  // Updates _map.json
}
```

**Status**: ✅ Implemented
**CLI Command**: Automatic (runs continuously when connected)

---

### 3. Send Code to ServiceNow

#### VSCode Extension
```typescript
// File: src/extension.ts
function saveFieldsToServiceNow(fileName, fromVsCode: boolean): boolean {
  let scriptObj = eu.fileNameToObject(fileName);
  // Convert file info to JSON
  // Send via WebSocket to browser extension
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(scriptObj));
    }
  });
}

// Triggered by file save event
vscode.workspace.onDidSaveTextDocument(document => {
  if (!saveFieldsToServiceNow(document, true)) {
    markFileAsDirty(document);
  }
});
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
private handleFileChange(filePath: string): void {
  const scriptObj = this.fileUtils.filePathToObject(filePath);
  this.sendToServiceNow(scriptObj);
}

private sendToServiceNow(scriptObj: any): void {
  scriptObj.saveSource = 'CLI';
  this.ws.send(JSON.stringify(scriptObj));
}

// Triggered by chokidar file watcher
this.fileWatcher.on('change', (filePath) => {
  this.handleFileChange(filePath);
});
```

**Status**: ✅ Implemented
**CLI Command**: Automatic (file watcher)

---

### 4. Receive Widget Data

#### VSCode Extension
```typescript
// File: src/extension.ts
function saveWidget(postedJson, retry = 0) {
  // Receives widget with multiple fields
  // Creates folder structure for sp_widget
  // Saves all widget files (template, css, scripts, etc.)
  // Creates _test_urls.txt
  // Requests ng_templates
}
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
private handleSaveWidget(message: any): void {
  // Placeholder for widget handling
  // Full implementation would mirror VSCode logic
}
```

**Status**: ⚠️ Partially implemented (basic structure, needs full widget logic)

---

### 5. Request Scope Artifacts

#### VSCode Extension
```typescript
// File: src/extension.ts
function requestScopeArtifacts(includeEmpty = false, scriptObj = null, showWarning = true) {
  // Gets scope from current file
  // Requests metadata for all artifacts in scope
  // Sends request via WebSocket to browser
  let requestJson = {
    action: 'requestRecords',
    actionGoal: 'writeInstanceMetaDataScope',
    includeEmpty: includeEmpty,
    tableName: 'sys_metadata',
    queryString: '...'
  };
  requestRecords(requestJson);
}

// Command: extension.requestScopeArtifacts
// Keybinding: Ctrl+Alt+A (Mac: Ctrl+Cmd+A)
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
async requestScopeArtifacts(includeEmpty: boolean = false): Promise<void> {
  // Reads instance settings from filesystem
  // Constructs request JSON
  // Sends via WebSocket
  const requestJson: any = {
    action: 'requestRecords',
    actionGoal: 'writeInstanceMetaDataScope',
    includeEmpty: includeEmpty,
    tableName: 'sys_metadata',
    queryString: '...'
  };
  this.ws.send(JSON.stringify(requestJson));
}
```

**Status**: ✅ Implemented
**CLI Command**: `sn-scriptsync pull [--all]`

---

### 6. Request Instance Metadata

#### VSCode Extension
```typescript
// File: src/extension.ts
function requestInstanceMetaData(showWarning = false) {
  // Requests table names from sys_db_object
  // Requests properties from sys_properties
  // Used for IntelliSense
  requestRecords({
    action: 'requestRecords',
    actionGoal: 'writeInstanceMetaData',
    tableName: 'sys_db_object',
    queryString: '...'
  });
}

// Command: extension.requestInstanceMetaData
// Keybinding: Ctrl+Alt+J (Mac: Ctrl+Cmd+J)
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
async requestInstanceMetaData(): Promise<void> {
  // Requests table names
  const tableNamesRequest = {
    action: 'requestRecords',
    actionGoal: 'writeInstanceMetaData',
    tableName: 'sys_db_object',
    queryString: '...'
  };
  this.ws.send(JSON.stringify(tableNamesRequest));
  
  // Requests properties
  const propertiesRequest = {
    action: 'requestRecords',
    actionGoal: 'writeInstanceMetaData',
    tableName: 'sys_properties',
    queryString: '...'
  };
  this.ws.send(JSON.stringify(propertiesRequest));
}
```

**Status**: ✅ Implemented
**CLI Command**: `sn-scriptsync metadata`

---

### 7. Open File in Instance

#### VSCode Extension
```typescript
// File: src/extension.ts
async function openInInstance(showWarning = true) {
  let scriptObj = eu.fileNameToObject(editor.document);
  let url = scriptObj.instance.url + "/";
  
  if (scriptObj.tableName == 'sp_widget'){
    url += 'sp_config?id=widget_editor&sys_id=' + scriptObj.sys_id;
  }
  else {
    url += scriptObj.tableName + '.do?sys_id=' + scriptObj.sys_id;
  }
  vscode.env.openExternal(vscode.Uri.parse(url));
}

// Command: extension.openInInstance
// Keybinding: Ctrl+Alt+I (Mac: Ctrl+Cmd+I)
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
async openInInstance(filePath: string): Promise<void> {
  const scriptObj = this.fileUtils.filePathToObject(filePath);
  
  // Send request to browser extension to open URL
  const message = {
    action: 'openInInstance',
    ...scriptObj
  };
  this.ws.send(JSON.stringify(message));
}
```

**Status**: ✅ Implemented
**CLI Command**: `sn-scriptsync open <file>`

---

### 8. Refresh File from Instance

#### VSCode Extension
```typescript
// File: src/extension.ts
async function refreshFromInstance(showWarning = true) {
  let scriptObj = eu.fileNameToObject(editor.document);
  
  scriptObj.action = 'requestRecord';
  scriptObj.actionGoal = 'getCurrent';
  scriptObj.sys_id = scriptObj.sys_id + "?sysparm_fields=...";
  requestRecords(scriptObj);
}

// Command: extension.refreshFromInstance
// Keybinding: Ctrl+Alt+R (Mac: Ctrl+Cmd+R)
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
async refreshFromInstance(filePath: string): Promise<void> {
  const scriptObj = this.fileUtils.filePathToObject(filePath);
  
  const requestJson = {
    action: 'requestRecord',
    actionGoal: 'getCurrent',
    instance: scriptObj.instance,
    tableName: scriptObj.tableName,
    fieldName: scriptObj.fieldName,
    fileName: filePath,
    sys_id: scriptObj.sys_id + "?sysparm_fields=..."
  };
  
  this.ws.send(JSON.stringify(requestJson));
}

private handleGetCurrent(message: any): void {
  // Writes updated content to file
  fs.writeFileSync(message.fileName, message.result[message.fieldName] || '');
}
```

**Status**: ✅ Implemented
**CLI Command**: `sn-scriptsync refresh <file>`

---

### 9. Background Script Execution

#### VSCode Extension
```typescript
// File: src/extension.ts
async function bgScriptExecute(showWarning = true) {
  let scriptObj = eu.fileNameToObject(editor.document);
  scriptObj.executeScript = true;
  scriptObj.action = 'executeBackgroundScript';
  
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(scriptObj));
    }
  });
}

// Command: extension.bgScriptExecute
// Keybinding: Ctrl+Enter (Mac: Cmd+Enter) - only in /background/ folder
```

#### CLI Implementation
```typescript
// Not yet implemented - would require:
async executeBackgroundScript(filePath: string, scope: string): Promise<void> {
  const content = fs.readFileSync(filePath, 'utf-8');
  
  const scriptObj = {
    action: 'executeBackgroundScript',
    executeScript: true,
    content: content,
    scope: scope,
    // ... other fields
  };
  
  this.ws.send(JSON.stringify(scriptObj));
}
```

**Status**: ❌ Not implemented
**Recommended CLI Command**: `sn-scriptsync execute <file> [--scope global|scoped]`

---

### 10. Selection to Background Script

#### VSCode Extension
```typescript
// File: src/extension.ts
async function selectionToBG(global = true) {
  let scriptObj = eu.fileNameToObject(editor.document);
  scriptObj.content = editor.document.getText(editor.selection);
  scriptObj.field = 'bg';
  scriptObj.table = 'background';
  scriptObj.fieldType = 'script';
  
  saveFieldAsFile(scriptObj);
}

// Commands: 
// - extension.bgScriptGlobal
// - extension.bgScriptScope
```

#### CLI Implementation
```typescript
// Not implemented - requires text selection which is editor-specific
// Would need to be implemented in editor plugins (Vim, Emacs, etc.)
```

**Status**: ❌ Not implemented (editor-specific feature)

---

### 11. Create New Artifact

#### VSCode Extension
```typescript
// File: src/extension.ts
async function createArtifact(artifact: any) {
  const requestJson = {
    action: 'createRecord',
    payload: artifact
  };
  
  wss.clients.forEach(function each(client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(requestJson));
    }
  });
}

function handleCreateRecordResponse(responseJson) {
  if (responseJson.success) {
    vscode.window.showInformationMessage(`Successfully created artifact: ${responseJson.newRecord.name}`);
    saveFieldAsFile(responseJson.newRecord);
  }
}

// Command: extension.createArtifact
```

#### CLI Implementation
```typescript
// Not yet implemented - would require:
async createArtifact(options: CreateArtifactOptions): Promise<void> {
  const requestJson = {
    action: 'createRecord',
    payload: {
      type: options.type,
      name: options.name,
      table: options.table,
      scope: options.scope,
      // ... other fields
    }
  };
  
  this.ws.send(JSON.stringify(requestJson));
}

private handleCreateRecordResponse(message: any): void {
  if (message.success) {
    console.log(chalk.green('✓ Successfully created artifact:'), message.newRecord.name);
    this.handleSaveFieldAsFile(message.newRecord);
  }
}
```

**Status**: ⚠️ Partially implemented (response handler exists, command interface needed)
**Recommended CLI Command**: `sn-scriptsync create --type <type> --name <name> --table <table>`

---

### 12. Link App to VSCode

#### VSCode Extension
```typescript
// File: src/extension.ts
function linkAppToVSCode(postedJson) {
  // Called from Studio in browser
  // Creates scope mapping
  // Requests scope artifacts
  
  let req = {
    action: 'requestAppMeta',
    actionGoal: 'saveCheck',
    scope: postedJson.appId,
    scopeLabel: postedJson.appName,
    scopeName: postedJson.appScope,
    instance: postedJson.instance
  };
  
  requestScopeArtifacts(false, req);
}
```

#### CLI Implementation
```typescript
// Handled automatically via handleMessage
// When browser sends linkAppToVSCode action, it's processed
// and scope artifacts are requested
```

**Status**: ✅ Implemented (automatic via message handler)

---

### 13. Message Routing

#### VSCode Extension
```typescript
// File: src/extension.ts
ws.on('message', function incoming(message) {
  let messageJson = JSON.parse(message);
  
  if (messageJson?.action == 'saveFieldAsFile')
    saveFieldAsFile(messageJson);
  else if (messageJson?.action == 'createRecordResponse')
    handleCreateRecordResponse(messageJson);
  else if (messageJson?.action == 'saveWidget')
    saveWidget(messageJson);
  else if (messageJson?.action == 'linkAppToVSCode')
    linkAppToVSCode(messageJson);
  // ... more routes
});
```

#### CLI Implementation
```typescript
// File: cli/src/ScriptSyncClient.ts
private handleMessage(message: any): void {
  if (message?.action === 'saveFieldAsFile') {
    this.handleSaveFieldAsFile(message);
  } else if (message?.action === 'saveWidget') {
    this.handleSaveWidget(message);
  } else if (message?.action === 'createRecordResponse') {
    this.handleCreateRecordResponse(message);
  }
  // ... same routes as VSCode
}
```

**Status**: ✅ Implemented

---

## Summary of Implementation Status

### Fully Implemented ✅
1. Connection Management (connect/disconnect)
2. Receive Code from Browser (saveFieldAsFile)
3. Send Code to ServiceNow (file watcher)
4. Request Scope Artifacts (pull command)
5. Request Instance Metadata (metadata command)
6. Open File in Instance (open command)
7. Refresh File from Instance (refresh command)
8. Message Routing

### Partially Implemented ⚠️
1. Widget Handling (structure exists, needs full logic)
2. Create Artifact (response handler exists, needs command)

### Not Implemented ❌
1. Background Script Execution
2. Selection to Background Script (editor-specific)

### Additional Recommended CLI Features
1. `sn-scriptsync execute <file> [--scope]` - Execute background scripts
2. `sn-scriptsync create --type <type> --name <name>` - Create new artifacts
3. `sn-scriptsync list [--table <table>]` - List available records
4. `sn-scriptsync search <query>` - Search for records
5. `sn-scriptsync diff <file>` - Compare with instance version
6. `sn-scriptsync logs [--follow]` - View sync logs
7. `sn-scriptsync use <instance>` - Switch between instances

## File Structure Compatibility

Both VSCode extension and CLI use the same file structure:

```
workspace/
└── instance-name/
    ├── settings.json           # Instance configuration
    ├── scopes.json            # Scope name to sys_id mapping
    ├── tablenames.d.ts        # Table names for IntelliSense
    ├── properties.d.ts        # Properties for IntelliSense
    └── scope-name/
        ├── scope.json         # Scope metadata
        └── table-name/
            ├── _map.json      # Record name to sys_id mapping
            ├── record.field.js
            └── widget/        # For folder-based tables
                ├── field1.js
                └── field2.html
```

This ensures seamless switching between VSCode extension and CLI.

## WebSocket Communication Protocol

### Message Types

#### From Browser Extension to VSCode/CLI
```json
{
  "action": "saveFieldAsFile",
  "instance": { "name": "dev12345", "url": "https://..." },
  "table": "sys_script",
  "sys_id": "abc123...",
  "name": "My Business Rule",
  "field": "script",
  "fieldType": "script",
  "content": "// code here",
  "scope": "global"
}
```

#### From VSCode/CLI to Browser Extension
```json
{
  "tableName": "sys_script",
  "sys_id": "abc123...",
  "fieldName": "script",
  "content": "// updated code",
  "saveSource": "CLI"
}
```

#### Requests from VSCode/CLI to Browser Extension
```json
{
  "action": "requestRecords",
  "actionGoal": "writeInstanceMetaDataScope",
  "instance": { "name": "dev12345", "url": "https://..." },
  "tableName": "sys_metadata",
  "queryString": "sysparm_fields=...",
  "filePath": "/path/to/save/result.json"
}
```

## Testing the Implementation

### Test Scenario 1: Basic Connection
```bash
# Terminal 1: Start CLI
cd ~/Documents/sn-scriptsync
sn-scriptsync connect

# Expected: Connection successful, file watcher started
```

### Test Scenario 2: Receive Code from Browser
```bash
# Terminal 1: CLI running
sn-scriptsync connect

# Browser: Click save button on a business rule
# Expected: File created in workspace
```

### Test Scenario 3: Send Code to ServiceNow
```bash
# Terminal 1: CLI running
sn-scriptsync connect

# Terminal 2: Edit file
vim instance/global/sys_script/Test.script.js
# Make changes, save (:w)

# Expected: Changes sent to ServiceNow
```

### Test Scenario 4: Pull Scope Artifacts
```bash
sn-scriptsync pull --all

# Expected: All scope artifacts downloaded to workspace
```

## Integration with Vim

See [VIM_INTEGRATION.md](./VIM_INTEGRATION.md) for detailed Vim integration patterns.
