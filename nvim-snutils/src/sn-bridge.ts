#!/usr/bin/env node

import axios from 'axios';
import * as fs from 'fs-extra';
import * as path from 'path';
import * as https from 'https';
import { FILE_EXTENSION_MAP, SERVICENOW_FIELDS } from './constants';

interface ServiceNowConfig {
    instance: string;
    username: string;
    password: string;
}

class ServiceNowBridge {
    private config: ServiceNowConfig;
    private baseUrl: string;

    constructor(config: ServiceNowConfig) {
        this.config = config;
        this.baseUrl = `${config.instance}/api/now/table`;
    }

    private getAuthHeaders() {
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        return {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }

    async downloadScript(tableName: string, sysId: string, fieldName: string): Promise<void> {
        try {
            const url = `${this.baseUrl}/${tableName}/${sysId}`;
            const response = await axios.get(url, {
                headers: this.getAuthHeaders(),
                params: {
                    sysparm_fields: `${fieldName},sys_name,sys_scope.scope,sys_package.name`
                },
                httpsAgent: new https.Agent({
                    rejectUnauthorized: false
                })
            });

            const record = response.data.result;
            const content = record[fieldName] || '';
            const name = record.sys_name || 'unknown';
            const scope = record['sys_scope.scope'] || 'global';
            
            // Generate file path
            const extension = FILE_EXTENSION_MAP[fieldName] || 'js';
            const fileName = `${name}.${fieldName}.${extension}`;
            const filePath = path.join(process.cwd(), this.config.instance.replace('https://', ''), scope, tableName, fileName);
            
            // Ensure directory exists
            await fs.ensureDir(path.dirname(filePath));
            
            // Write file
            await fs.writeFile(filePath, content);
            
            console.log(`Downloaded: ${filePath}`);
        } catch (error) {
            console.error('Error downloading script:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }

    async uploadScript(filePath: string): Promise<void> {
        try {
            // Parse file path to extract table, sys_id, and field
            const pathParts = filePath.split(path.sep);
            const fileName = path.basename(filePath);
            const [name, field, extension] = fileName.split('.');
            
            // For now, we'll need the sys_id to be provided or stored in metadata
            // This is a simplified version - in a real implementation, we'd need to store
            // the sys_id when downloading or provide it as a parameter
            console.error('Upload functionality requires sys_id mapping - not implemented yet');
            process.exit(1);
        } catch (error) {
            console.error('Error uploading script:', error instanceof Error ? error.message : String(error));
            process.exit(1);
        }
    }
}

// Main CLI interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.error('Usage: node sn-bridge.js <action> [options]');
        process.exit(1);
    }

    const action = args[0];
    
    // Parse command line arguments
    const config: ServiceNowConfig = {
        instance: '',
        username: '',
        password: ''
    };

    for (let i = 1; i < args.length; i += 2) {
        const key = args[i];
        const value = args[i + 1];
        
        switch (key) {
            case '--instance':
                config.instance = value;
                break;
            case '--username':
                config.username = value;
                break;
            case '--password':
                config.password = value;
                break;
        }
    }

    // Validate config
    if (!config.instance || !config.username || !config.password) {
        console.error('Missing required configuration: instance, username, password');
        process.exit(1);
    }

    const bridge = new ServiceNowBridge(config);

    switch (action) {
        case 'download':
            if (args.length < 8) {
                console.error('Usage: download --instance <url> --username <user> --password <pass> <table> <sys_id> <field>');
                process.exit(1);
            }
            const tableName = args[args.length - 3];
            const sysId = args[args.length - 2];
            const fieldName = args[args.length - 1];
            await bridge.downloadScript(tableName, sysId, fieldName);
            break;
            
        case 'upload':
            if (args.length < 8) {
                console.error('Usage: upload --instance <url> --username <user> --password <pass> <file_path>');
                process.exit(1);
            }
            const filePath = args[args.length - 1];
            await bridge.uploadScript(filePath);
            break;
            
        default:
            console.error(`Unknown action: ${action}`);
            process.exit(1);
    }
}

main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});