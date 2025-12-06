import * as fs from 'fs';
import * as path from 'path';

// Constants from the extension
const FOLDERRECORDTABLES = ['sp_widget', 'sp_header_footer'];

const FIELDTYPES: Record<string, { extension: string }> = {
  'script': { extension: '.js' },
  'html': { extension: '.html' },
  'css': { extension: '.css' },
  'xml': { extension: '.xml' },
  'json': { extension: '.json' },
  'properties': { extension: '.scss' },
  'string': { extension: '.txt' },
  'conditions': { extension: '.txt' }
};

export class FileUtils {
  private workspace: string;

  constructor(workspace: string) {
    this.workspace = workspace;
  }

  getFileAsJson(filePath: string): any {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      // File doesn't exist or is not valid JSON
      if (error instanceof Error && 'code' in error && (error as any).code !== 'ENOENT') {
        console.error(`Warning: Failed to parse JSON file ${filePath}:`, error.message);
      }
      return {};
    }
  }

  writeInstanceSettings(instance: any): void {
    const settingsPath = path.join(this.workspace, instance.name, 'settings.json');
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    fs.writeFileSync(settingsPath, JSON.stringify(instance, null, 4));
  }

  readMapping(mappingFile: string): Record<string, string> {
    try {
      return JSON.parse(fs.readFileSync(mappingFile, 'utf-8'));
    } catch {
      return {};
    }
  }

  writeMapping(mappingFile: string, mapping: Record<string, string>): void {
    fs.mkdirSync(path.dirname(mappingFile), { recursive: true });
    fs.writeFileSync(mappingFile, JSON.stringify(mapping, null, 2));
  }

  isFolderRecordTable(tableName: string): boolean {
    return FOLDERRECORDTABLES.includes(tableName);
  }

  getFileExtension(fieldType: string, fieldName: string): string {
    const type = FIELDTYPES[fieldType];
    if (type) {
      return type.extension;
    }

    if (fieldType.includes('xml')) return '.xml';
    if (fieldType.includes('html')) return '.html';
    if (fieldType.includes('json')) return '.json';
    if (fieldType.includes('css') || fieldType === 'properties' || fieldName === 'css') return '.scss';
    if (fieldType.includes('string') || fieldType === 'conditions') return '.txt';

    return '.js'; // Default
  }

  filePathToObject(filePath: string): any {
    const relativePath = path.relative(this.workspace, filePath);
    const parts = relativePath.split(path.sep);

    if (parts.length < 5) {
      return true; // Not a valid synced file
    }

    // Format: instance/scope/table/name.field.extension
    const instanceName = parts[0];
    const scopeName = parts[1];
    const tableName = parts[2];

    const basePath = path.join(this.workspace, instanceName);
    const fullTablePath = path.join(basePath, scopeName, tableName);

    // Load instance settings
    const settingsPath = path.join(basePath, 'settings.json');
    if (!fs.existsSync(settingsPath)) {
      return true;
    }
    const instance = this.getFileAsJson(settingsPath);

    // Load scopes
    let scopes: Record<string, string> = { 'global': 'global' };
    if (scopeName !== 'global') {
      const scopesPath = path.join(basePath, 'scopes.json');
      if (fs.existsSync(scopesPath)) {
        scopes = this.getFileAsJson(scopesPath);
      }
    }

    // Load mapping
    const mappingFile = path.join(fullTablePath, '_map.json');
    const nameToSysId = this.readMapping(mappingFile);

    // Parse filename
    const fileName = path.basename(filePath);
    const isFolderTable = this.isFolderRecordTable(tableName);

    let recordName: string;
    let fieldName: string;
    let fileExtension: string;

    if (isFolderTable) {
      // For folder tables: instance/scope/table/recordname/field.extension
      recordName = parts[3];
      const filenameParts = fileName.split('.');
      fieldName = filenameParts[0];
      fileExtension = filenameParts.slice(1).join('.');
    } else {
      // For regular files: instance/scope/table/recordname.field.extension
      const match = /^(?<recordName>[^.]+)\.(?<fieldName>[^.]+)\.(?<fileExtension>.+)$/.exec(fileName);
      if (!match || !match.groups) {
        return true;
      }
      recordName = match.groups.recordName;
      fieldName = match.groups.fieldName;
      fileExtension = match.groups.fileExtension;
    }

    const sys_id = nameToSysId[recordName];
    if (!sys_id) {
      return true; // Not mapped
    }

    // Read file content
    const content = fs.readFileSync(filePath, 'utf-8');

    return {
      instance: instance,
      tableName: tableName,
      name: recordName,
      fieldName: fieldName,
      sys_id: sys_id,
      scopeName: scopeName,
      scope: scopes[scopeName],
      fileName: filePath,
      content: content
    };
  }

  generateMetaDataTypeScript(messageJson: any): string {
    const tableToType: Record<string, string> = {
      'sys_db_object': 'InstanceTableNames',
      'sys_properties': 'InstanceProperties'
    };

    let content = `declare type ${tableToType[messageJson.tableName] || 'unknown'} = \n`;
    for (const row of messageJson.results) {
      content += ` | "${row.name}" \n`;
    }
    return content;
  }
}
