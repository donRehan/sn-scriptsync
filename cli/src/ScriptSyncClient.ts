import WebSocket from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import * as chokidar from 'chokidar';
import chalk from 'chalk';
import { FileUtils } from './FileUtils';

export class ScriptSyncClient {
  private ws: WebSocket | null = null;
  private host: string;
  private port: number;
  private workspace: string;
  private fileWatcher: chokidar.FSWatcher | null = null;
  private fileUtils: FileUtils;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private lastSave: Map<string, number> = new Map();
  private isReconnecting: boolean = false;

  constructor(host: string, port: number, workspace: string) {
    this.host = host;
    this.port = port;
    this.workspace = workspace;
    this.fileUtils = new FileUtils(workspace);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `ws://${this.host}:${this.port}`;
      this.ws = new WebSocket(url);

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
        if (this.ws) {
          this.ws.close();
        }
      }, 5000);

      this.ws.on('open', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.isReconnecting = false;
        console.log(chalk.gray(`Connected to WebSocket server at ${url}`));
        this.setupMessageHandler();
        this.startFileWatcher();
        resolve();
      });

      this.ws.on('error', (error) => {
        clearTimeout(timeout);
        this.isConnected = false;
        reject(error);
      });

      this.ws.on('close', () => {
        this.isConnected = false;
        console.log(chalk.yellow('Connection closed'));
        
        // Attempt to reconnect (with guard against concurrent attempts)
        if (this.reconnectAttempts < this.maxReconnectAttempts && !this.isReconnecting) {
          this.isReconnecting = true;
          this.reconnectAttempts++;
          console.log(chalk.gray(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`));
          setTimeout(() => {
            this.isReconnecting = false;
            this.connect();
          }, 2000);
        }
      });
    });
  }

  disconnect(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.isConnected = false;
  }

  private setupMessageHandler(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error(chalk.red('Error parsing message:'), error);
      }
    });
  }

  private handleMessage(message: any): void {
    // Handle connection acknowledgment
    if (Array.isArray(message) && message[0] === 'Connected to VS Code ScriptSync WebSocket') {
      console.log(chalk.gray('Browser extension acknowledged connection'));
      return;
    }

    // Handle instance settings
    if (message?.instance) {
      this.fileUtils.writeInstanceSettings(message.instance);
    }

    // Handle different action types
    if (message?.action === 'saveFieldAsFile') {
      this.handleSaveFieldAsFile(message);
    } else if (message?.action === 'saveWidget') {
      this.handleSaveWidget(message);
    } else if (message?.action === 'createRecordResponse') {
      this.handleCreateRecordResponse(message);
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
    } else if (message?.error) {
      this.handleError(message);
    } else if (message?.action === 'bannerMessage') {
      console.log(chalk.blue('Browser extension message:'), message.message);
    }
  }

  private handleSaveFieldAsFile(message: any): void {
    console.log(chalk.green('← Receiving code from browser:'), message.table, message.name);
    
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
    
    console.log(chalk.gray(`  Saved to: ${fileName}`));
  }

  private handleSaveWidget(message: any): void {
    console.log(chalk.green('← Receiving widget from browser:'), message.name);
    // Widget handling logic here - similar to saveWidget in extension.ts
  }

  private handleCreateRecordResponse(message: any): void {
    if (message.success) {
      console.log(chalk.green('✓ Successfully created artifact:'), message.newRecord.name);
    } else {
      console.log(chalk.red('✗ Failed to create artifact:'), message.error);
    }
  }

  private handleBackgroundScriptResponse(message: any): void {
    console.log(chalk.cyan('Background Script Result:'));
    console.log(message.data);
  }

  private handleGetCurrent(message: any): void {
    console.log(chalk.green('← Received file content from instance'));
    fs.mkdirSync(path.dirname(message.fileName), { recursive: true });
    fs.writeFileSync(message.fileName, message.result[message.fieldName] || '');
    console.log(chalk.gray(`  Updated: ${message.fileName}`));
  }

  private handleInstanceMetaData(message: any): void {
    console.log(chalk.green('← Received instance metadata'));
    const content = this.fileUtils.generateMetaDataTypeScript(message);
    fs.writeFileSync(message.filePath, content);
    console.log(chalk.gray(`  Saved to: ${message.filePath}`));
  }

  private handleInstanceScope(message: any): void {
    console.log(chalk.green('← Received instance scope'));
  }

  private handleInstanceMetaDataScope(message: any): void {
    console.log(chalk.green('← Received scope metadata'));
  }

  private handleTableFields(message: any): void {
    console.log(chalk.green('← Received table fields'));
  }

  private handleError(message: any): void {
    console.error(chalk.red('✗ Error from browser extension:'));
    if (message.error?.detail) {
      console.error(chalk.red('  ' + message.error.detail));
    } else {
      console.error(chalk.red('  ' + JSON.stringify(message.error, null, 2)));
    }
  }

  private startFileWatcher(): void {
    if (this.fileWatcher) {
      return; // Already watching
    }

    console.log(chalk.gray('Starting file watcher...'));

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
      this.handleFileChange(filePath);
    });

    console.log(chalk.gray('File watcher started'));
  }

  private handleFileChange(filePath: string): void {
    // Prevent rapid successive saves
    const now = Date.now();
    const lastSaveTime = this.lastSave.get(filePath) || 0;
    
    if (now - lastSaveTime < 1000) {
      return; // Debounce saves within 1 second
    }
    
    this.lastSave.set(filePath, now);

    const scriptObj = this.fileUtils.filePathToObject(filePath);
    
    if (!scriptObj || scriptObj === true || !scriptObj.sys_id) {
      return; // Not a recognized file
    }

    if (scriptObj.fieldName === '_test_urls') {
      return; // Helper file, don't save to instance
    }

    if (scriptObj.tableName === 'background') {
      return; // Background scripts don't sync to instance
    }

    console.log(chalk.blue('→ Sending changes to ServiceNow:'), scriptObj.tableName, scriptObj.name);
    this.sendToServiceNow(scriptObj);
  }

  private sendToServiceNow(scriptObj: any): void {
    if (!this.ws || !this.isConnected) {
      console.error(chalk.red('✗ Not connected to browser extension'));
      return;
    }

    scriptObj.saveSource = 'CLI';

    if (scriptObj.fieldName.startsWith('variable-')) {
      scriptObj.fieldName = scriptObj.fieldName.substring(9);
      scriptObj.action = 'updateVar';
    }

    try {
      this.ws.send(JSON.stringify(scriptObj));
      console.log(chalk.gray('  Sent successfully'));
    } catch (error) {
      console.error(chalk.red('✗ Error sending to ServiceNow:'), error);
    }
  }

  // Public methods for CLI commands

  async requestScopeArtifacts(includeEmpty: boolean = false): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to browser extension');
    }

    // Try to get current file context
    const files = fs.readdirSync(this.workspace);
    if (files.length === 0) {
      throw new Error('No instance directories found in workspace');
    }

    // Find the first instance directory
    const instanceDirs = files.filter(f => {
      const fullPath = path.join(this.workspace, f);
      return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
    });

    if (instanceDirs.length === 0) {
      throw new Error('No instance directories found');
    }

    const instanceName = instanceDirs[0];
    const settingsPath = path.join(this.workspace, instanceName, 'settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      throw new Error('Instance settings.json not found. Please connect via browser first.');
    }

    const instance = this.fileUtils.getFileAsJson(settingsPath);
    const scopesPath = path.join(this.workspace, instanceName, 'scopes.json');
    const scopes = this.fileUtils.getFileAsJson(scopesPath);

    if (Object.keys(scopes).length === 0) {
      throw new Error('No scopes found. Please connect via browser first.');
    }

    // Get first scope
    const scopeName = Object.keys(scopes)[0];
    const scopeId = scopes[scopeName];

    const requestJson: any = {
      action: 'requestRecords',
      instance: instance,
      actionGoal: 'writeInstanceMetaDataScope',
      includeEmpty: includeEmpty,
      filePath: path.join(this.workspace, instanceName, scopeName, 'scope.json'),
      scopeName: scopeName,
      tableName: 'sys_metadata',
      queryString: `sysparm_fields=sys_class_name,sys_name,sys_id,sys_updated_on&sysparm_query=sys_scope=${scopeId}^sys_class_name!=sys_metadata_delete^sys_update_name!=NULL^ORDERBYDESCsys_class_name`
    };

    this.ws.send(JSON.stringify(requestJson));
  }

  async requestInstanceMetaData(): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to browser extension');
    }

    const files = fs.readdirSync(this.workspace);
    const instanceDirs = files.filter(f => {
      const fullPath = path.join(this.workspace, f);
      return fs.statSync(fullPath).isDirectory() && !f.startsWith('.');
    });

    if (instanceDirs.length === 0) {
      throw new Error('No instance directories found');
    }

    const instanceName = instanceDirs[0];
    const settingsPath = path.join(this.workspace, instanceName, 'settings.json');
    
    if (!fs.existsSync(settingsPath)) {
      throw new Error('Instance settings.json not found');
    }

    const instance = this.fileUtils.getFileAsJson(settingsPath);
    const filePath = path.join(this.workspace, instanceName);

    // Request table names
    const tableNamesRequest: any = {
      action: 'requestRecords',
      actionGoal: 'writeInstanceMetaData',
      instance: instance,
      filePath: path.join(filePath, 'tablenames.d.ts'),
      tableName: 'sys_db_object',
      displayValueField: 'name',
      queryString: 'sysparm_query=nameNOT LIKE00^sys_update_nameISNOTEMPTY^ORDERBYname&sysparm_fields=name&sysparm_no_count=true'
    };

    this.ws.send(JSON.stringify(tableNamesRequest));

    // Request properties
    const propertiesRequest: any = {
      action: 'requestRecords',
      actionGoal: 'writeInstanceMetaData',
      instance: instance,
      filePath: path.join(filePath, 'properties.d.ts'),
      tableName: 'sys_properties',
      queryString: 'sysparm_query=ORDERBYname&sysparm_fields=name&sysparm_no_count=true'
    };

    this.ws.send(JSON.stringify(propertiesRequest));
  }

  async openInInstance(filePath: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to browser extension');
    }

    const scriptObj = this.fileUtils.filePathToObject(filePath);
    
    if (!scriptObj || scriptObj === true) {
      throw new Error('Not a valid synced file');
    }

    // The browser extension will handle opening the URL
    const message = {
      action: 'openInInstance',
      ...scriptObj
    };

    this.ws.send(JSON.stringify(message));
  }

  async refreshFromInstance(filePath: string): Promise<void> {
    if (!this.ws || !this.isConnected) {
      throw new Error('Not connected to browser extension');
    }

    const scriptObj = this.fileUtils.filePathToObject(filePath);
    
    if (!scriptObj || scriptObj === true) {
      throw new Error('Not a valid synced file');
    }

    const requestJson: any = {
      action: 'requestRecord',
      actionGoal: 'getCurrent',
      instance: scriptObj.instance,
      tableName: scriptObj.tableName,
      fieldName: scriptObj.fieldName,
      fileName: filePath,
      name: scriptObj.name,
      sys_id: scriptObj.sys_id + `?sysparm_fields=name,sys_updated_on,sys_updated_by,sys_scope.scope,${scriptObj.fieldName}`
    };

    this.ws.send(JSON.stringify(requestJson));
  }
}
