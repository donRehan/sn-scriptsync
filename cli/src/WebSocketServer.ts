import WebSocket, { Server as WSServer } from 'ws';
import * as http from 'http';
import chalk from 'chalk';
import { FileUtils } from './FileUtils';
import * as path from 'path';
import * as fs from 'fs';
import * as chokidar from 'chokidar';

/**
 * Standalone WebSocket server that replaces VS Code extension's server
 * Allows CLI to work independently with browser extension
 */
export class ScriptSyncServer {
  private wss: WSServer | null = null;
  private port: number;
  private host: string;
  private workspace: string;
  private fileUtils: FileUtils;
  private isRunning: boolean = false;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private lastSave: Map<string, number> = new Map();
  private ignoredFiles: Set<string> = new Set(); // Files saved from ServiceNow, skip watching

  constructor(port: number = 1978, host: string = '127.0.0.1', workspace: string) {
    this.port = port;
    this.host = host;
    this.workspace = workspace;
    this.fileUtils = new FileUtils(workspace);
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isRunning) {
        reject(new Error('Server is already running'));
        return;
      }

      try {
        this.wss = new WSServer({ port: this.port, host: this.host });

        this.wss.on('listening', () => {
          this.isRunning = true;
          console.log(chalk.green(`✓ WebSocket server started on ${this.host}:${this.port}`));
          console.log(chalk.gray('  Waiting for browser extension connection...'));
          this.startFileWatcher();
          resolve();
        });

        this.wss.on('error', (error) => {
          console.error(chalk.red('✗ Server error:'), error.message);
          reject(error);
        });

        this.wss.on('connection', (ws: WebSocket, req) => {
          const origin = req.headers.origin || '';
          console.log(chalk.blue('← Connection attempt from:'), origin || 'local');

          // Check origin - only allow browser extensions or undefined (test clients)
          if (origin && origin.startsWith('http://') || origin.startsWith('https://')) {
            console.log(chalk.yellow('! Rejected HTTP/HTTPS connection (only browser extensions allowed)'));
            ws.close(1008, 'Not allowed');
            return;
          }

          // Limit to one connection at a time
          if (this.wss && this.wss.clients.size > 1) {
            console.log(chalk.yellow('! Rejected connection (max connections reached)'));
            ws.close(1008, 'Max connection');
            return;
          }

          console.log(chalk.green('✓ Connection accepted'));
          this.setupClientHandlers(ws);

          // Send connection acknowledgment
          ws.send('["Connected to CLI WebSocket Server"]', () => {});
          ws.send(JSON.stringify({
            action: 'bannerMessage',
            message: 'Connected to sn-scriptsync CLI server',
            class: 'alert alert-success'
          }), () => {});
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  stop(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    
    if (this.wss) {
      this.wss.clients.forEach(client => client.close());
      this.wss.close();
      this.wss = null;
      this.isRunning = false;
      console.log(chalk.yellow('WebSocket server stopped'));
    }
  }

  private setupClientHandlers(ws: WebSocket): void {
    ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message, ws);
      } catch (error) {
        console.error(chalk.red('Error parsing message:'), error);
      }
    });

    ws.on('close', () => {
      console.log(chalk.gray('Browser extension disconnected'));
    });

    ws.on('error', (error) => {
      console.error(chalk.red('Client connection error:'), error.message);
    });
  }

  private handleMessage(message: any, ws: WebSocket): void {
    // Handle errors from browser extension
    if (message.hasOwnProperty('error')) {
      console.error(chalk.red('✗ Error from browser extension:'));
      if (message.error?.detail) {
        let detail = message.error.detail;
        if (detail.includes("ACL")) {
          detail = "ACL Error, try changing scope in the browser";
        } else if (detail.includes("Required to provide Auth information")) {
          detail = "Could not sync file, no valid token. Try typing /token in browser and retry.";
        }
        console.error(chalk.red('  ' + detail));
      } else {
        console.error(chalk.red('  ' + JSON.stringify(message.error, null, 2)));
      }
      return;
    }

    // Handle instance settings
    if (message?.instance) {
      this.fileUtils.writeInstanceSettings(message.instance);
      console.log(chalk.gray(`  Instance: ${message.instance.name} (${message.instance.url})`));
    }

    // Handle different actions
    if (message?.action === 'saveFieldAsFile') {
      this.handleSaveFieldAsFile(message);
    } else if (message?.action === 'createRecordResponse') {
      this.handleCreateRecordResponse(message);
    } else if (message?.action === 'saveWidget') {
      this.handleSaveWidget(message);
    } else if (message?.action === 'linkAppToVSCode') {
      this.handleLinkAppToVSCode(message);
    } else if (message.instance && !message?.action) {
      this.handleRefreshedToken(message, ws);
    } else if (message?.action === 'responseFromBackgroundScript') {
      this.handleBackgroundScriptResponse(message);
    } else if (message?.actionGoal === 'getCurrent') {
      this.handleGetCurrent(message);
    } else if (message?.actionGoal === 'writeInstanceMetaData') {
      this.handleInstanceMetaData(message);
    } else if (message?.actionGoal === 'writeInstanceScope') {
      this.handleInstanceScope(message);
    } else if (message?.actionGoal === 'writeInstanceMetaDataScope') {
      this.handleInstanceMetaDataScope(message);
    } else if (message?.actionGoal === 'writeTableFields') {
      this.handleTableFields(message);
    }
  }

  private handleSaveFieldAsFile(message: any): void {
    console.log(chalk.green('← Receiving file from ServiceNow'));
    console.log(chalk.gray(`  Table: ${message.table}, Name: ${message.name}`));

    const basePath = path.join(this.workspace, message.instance.name);

    let scope: string;
    if (message.scope === 'global') {
      scope = 'global';
    } else if (message.scope === '' || !message.hasOwnProperty('scope')) {
      scope = 'no_scope';
    } else {
      const scopes = this.fileUtils.getFileAsJson(path.join(basePath, 'scopes.json'));
      const invertedScopes = Object.entries(scopes).reduce((acc, [key, value]) => {
        acc[value as string] = key;
        return acc;
      }, {} as Record<string, string>);
      scope = invertedScopes[message.scope] || message.scope;
    }

    const fullPath = path.join(basePath, scope, message.table);
    const mappingFile = path.join(fullPath, '_map.json');
    const nameToSysId = this.fileUtils.readMapping(mappingFile);

    let cleanName = message.name.replace(/[^a-z0-9\._\-+]+/gi, '').replace(/\./g, '-') || message.sys_id;
    cleanName = Object.keys(nameToSysId).find(fileName => nameToSysId[fileName] === message.sys_id) ?? cleanName;

    if (nameToSysId[cleanName] && nameToSysId[cleanName] !== message.sys_id) {
      cleanName = cleanName + ("-" + message.sys_id.slice(0, 2) + message.sys_id.slice(-2)).toUpperCase();
    }

    nameToSysId[cleanName] = message.sys_id;
    this.fileUtils.writeMapping(mappingFile, nameToSysId);

    const extension = this.fileUtils.getFileExtension(message.fieldType, message.field);
    const isFolderRecord = this.fileUtils.isFolderRecordTable(message.table);
    const separator = isFolderRecord ? path.sep : '.';

    const fileName = path.join(fullPath, `${cleanName}${separator}${message.field}${extension}`);

    fs.mkdirSync(path.dirname(fileName), { recursive: true });
    fs.writeFileSync(fileName, message.content || '');

    // Mark this file as ignored to prevent file watcher from triggering
    this.ignoredFiles.add(fileName);
    setTimeout(() => this.ignoredFiles.delete(fileName), 2000); // Remove after 2 seconds

    console.log(chalk.green('✓ File saved:'), path.relative(this.workspace, fileName));
  }

  private handleSaveWidget(message: any): void {
    console.log(chalk.green('← Receiving widget from ServiceNow:'), message.name);
    // Widget handling - simplified version
  }

  private handleCreateRecordResponse(message: any): void {
    if (message.success) {
      console.log(chalk.green('✓ Successfully created artifact:'), message.newRecord?.name);
    } else {
      console.log(chalk.red('✗ Failed to create artifact'));
    }
  }

  private handleLinkAppToVSCode(message: any): void {
    console.log(chalk.green('← Linking app to workspace:'), message.appName);
    // Handle app linking
  }

  private handleRefreshedToken(message: any, ws: WebSocket): void {
    console.log(chalk.green('✓ Token refreshed for instance:'), message.instance.name);
    message.refreshedtoken = true;
    message.response = `Refreshed token in CLI via /token command. Instance: ${message.instance.name}`;
    ws.send(JSON.stringify(message));
  }

  private handleBackgroundScriptResponse(message: any): void {
    console.log(chalk.cyan('Background Script Result:'));
    console.log(message.data);
  }

  private handleGetCurrent(message: any): void {
    console.log(chalk.green('← Received file content from instance'));
    fs.mkdirSync(path.dirname(message.fileName), { recursive: true });
    fs.writeFileSync(message.fileName, message.result[message.fieldName] || '');
    console.log(chalk.green('✓ Updated:'), path.relative(this.workspace, message.fileName));
  }

  private handleInstanceMetaData(message: any): void {
    console.log(chalk.green('← Received instance metadata'));
    const content = this.fileUtils.generateMetaDataTypeScript(message);
    fs.writeFileSync(message.filePath, content);
    console.log(chalk.green('✓ Saved metadata:'), path.relative(this.workspace, message.filePath));
  }

  private handleInstanceScope(message: any): void {
    console.log(chalk.green('← Received instance scope data'));
  }

  private handleInstanceMetaDataScope(message: any): void {
    console.log(chalk.green('← Received scope metadata'));
  }

  private handleTableFields(message: any): void {
    console.log(chalk.green('← Received table fields'));
  }

  broadcast(message: any): void {
    if (!this.wss) return;

    const data = JSON.stringify(message);
    this.wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  getClientCount(): number {
    return this.wss?.clients.size || 0;
  }

  isServerRunning(): boolean {
    return this.isRunning;
  }

  private startFileWatcher(): void {
    if (this.fileWatcher) {
      return; // Already watching
    }

    console.log(chalk.gray('Starting file watcher...'));
    console.log(chalk.gray(`  Watching: ${this.workspace}`));

    // Watch all files in the workspace, excluding certain directories
    this.fileWatcher = chokidar.watch(this.workspace, {
      ignored: [
        /(^|[\/\\])\../, // dotfiles
        '**/node_modules/**',
        '**/autocomplete/**',
        '**/_map.json',
        '**/settings.json',
        '**/scopes.json',
        '**/scope.json',
        '**/*.d.ts'
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    });

    this.fileWatcher.on('change', (filePath) => {
      console.log(chalk.cyan('→ File change detected:'), filePath);
      this.handleFileChange(filePath);
    });

    this.fileWatcher.on('error', (error) => {
      console.error(chalk.red('File watcher error:'), error);
    });

    this.fileWatcher.on('ready', () => {
      console.log(chalk.gray('✓ File watcher started - edits will auto-sync to ServiceNow'));
    });
  }

  private handleFileChange(filePath: string): void {
    // Skip if this file was just saved from ServiceNow (prevents loop)
    if (this.ignoredFiles.has(filePath)) {
      console.log(chalk.gray('  Skipped: File just received from ServiceNow'));
      return;
    }

    // Prevent rapid successive saves
    const now = Date.now();
    const lastSaveTime = this.lastSave.get(filePath) || 0;
    
    if (now - lastSaveTime < 1000) {
      console.log(chalk.gray('  Debounced (too soon)'));
      return; // Debounce saves within 1 second
    }
    
    this.lastSave.set(filePath, now);

    console.log(chalk.gray('  Parsing file path...'));
    const scriptObj = this.fileUtils.filePathToObject(filePath);
    
    if (!scriptObj || scriptObj === true) {
      console.log(chalk.yellow('  ⚠ Not a recognized ServiceNow file (check path structure)'));
      console.log(chalk.gray(`    Expected: workspace/instance/scope/table/name.field.ext`));
      console.log(chalk.gray(`    Got: ${path.relative(this.workspace, filePath)}`));
      return; // Not a recognized file
    }

    if (!scriptObj.sys_id) {
      console.log(chalk.yellow('  ⚠ File not in _map.json (sys_id not found)'));
      console.log(chalk.gray(`    Pull this file from ServiceNow first to establish mapping`));
      return;
    }

    if (scriptObj.fieldName === '_test_urls') {
      console.log(chalk.gray('  Skipped: Test URL file'));
      return; // Helper file, don't save to instance
    }

    if (scriptObj.tableName === 'background') {
      console.log(chalk.gray('  Skipped: Background script (run-only)'));
      return; // Background scripts don't sync to instance
    }

    console.log(chalk.blue('→ Syncing to ServiceNow'));
    console.log(chalk.gray(`  Table: ${scriptObj.tableName}`));
    console.log(chalk.gray(`  Name: ${scriptObj.name}`));
    console.log(chalk.gray(`  Field: ${scriptObj.fieldName}`));
    this.sendToServiceNow(scriptObj);
  }

  private sendToServiceNow(scriptObj: any): void {
    if (!this.wss || this.getClientCount() === 0) {
      console.error(chalk.red('✗ No browser extension connected'));
      console.log(chalk.yellow('  Run /token in ServiceNow to connect'));
      return;
    }

    scriptObj.saveSource = 'CLI';

    if (scriptObj.fieldName.startsWith('variable-')) {
      scriptObj.fieldName = scriptObj.fieldName.substring(9);
      scriptObj.action = 'updateVar';
    }

    try {
      this.broadcast(scriptObj);
      console.log(chalk.green('✓ Sent to ServiceNow successfully'));
    } catch (error) {
      console.error(chalk.red('✗ Error sending to ServiceNow:'), error);
    }
  }
}
