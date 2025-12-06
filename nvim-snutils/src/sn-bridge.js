#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = require("axios");
const fs = require("fs-extra");
const path = require("path");
const https = require("https");
const constants_1 = require("./constants");
class ServiceNowBridge {
    constructor(config) {
        this.config = config;
        this.baseUrl = `${config.instance}/api/now/table`;
    }
    getAuthHeaders() {
        const auth = Buffer.from(`${this.config.username}:${this.config.password}`).toString('base64');
        return {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        };
    }
    downloadScript(tableName, sysId, fieldName) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const url = `${this.baseUrl}/${tableName}/${sysId}`;
                const response = yield axios_1.default.get(url, {
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
                const extension = constants_1.FILE_EXTENSION_MAP[fieldName] || 'js';
                const fileName = `${name}.${fieldName}.${extension}`;
                const filePath = path.join(process.cwd(), this.config.instance.replace('https://', ''), scope, tableName, fileName);
                // Ensure directory exists
                yield fs.ensureDir(path.dirname(filePath));
                // Write file
                yield fs.writeFile(filePath, content);
                console.log(`Downloaded: ${filePath}`);
            }
            catch (error) {
                console.error('Error downloading script:', error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
    }
    uploadScript(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
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
            }
            catch (error) {
                console.error('Error uploading script:', error instanceof Error ? error.message : String(error));
                process.exit(1);
            }
        });
    }
}
// Main CLI interface
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        const args = process.argv.slice(2);
        if (args.length < 1) {
            console.error('Usage: node sn-bridge.js <action> [options]');
            process.exit(1);
        }
        const action = args[0];
        // Parse command line arguments
        const config = {
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
                yield bridge.downloadScript(tableName, sysId, fieldName);
                break;
            case 'upload':
                if (args.length < 8) {
                    console.error('Usage: upload --instance <url> --username <user> --password <pass> <file_path>');
                    process.exit(1);
                }
                const filePath = args[args.length - 1];
                yield bridge.uploadScript(filePath);
                break;
            default:
                console.error(`Unknown action: ${action}`);
                process.exit(1);
        }
    });
}
main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
});
//# sourceMappingURL=sn-bridge.js.map