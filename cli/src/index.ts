#!/usr/bin/env node

import { Command } from 'commander';
import { ScriptSyncClient } from './ScriptSyncClient';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

const program = new Command();

program
  .name('sn-scriptsync')
  .description('CLI tool for ServiceNow script synchronization via browser extension')
  .version('1.0.0');

program
  .command('connect')
  .description('Connect to the browser extension WebSocket server')
  .option('-p, --port <port>', 'WebSocket port', '1978')
  .option('-h, --host <host>', 'WebSocket host', '127.0.0.1')
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .action(async (options) => {
    const client = new ScriptSyncClient(options.host, parseInt(options.port), options.workspace);
    
    try {
      await client.connect();
      console.log(chalk.green('✓ Connected to browser extension'));
      console.log(chalk.blue('Watching for file changes...'));
      
      // Keep the process running
      process.on('SIGINT', () => {
        console.log(chalk.yellow('\nDisconnecting...'));
        client.disconnect();
        process.exit(0);
      });
    } catch (error) {
      console.error(chalk.red('✗ Connection failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Check connection status to browser extension')
  .option('-p, --port <port>', 'WebSocket port', '1978')
  .option('-h, --host <host>', 'WebSocket host', '127.0.0.1')
  .action(async (options) => {
    const client = new ScriptSyncClient(options.host, parseInt(options.port), process.cwd());
    
    try {
      await client.connect();
      console.log(chalk.green('✓ Browser extension is reachable'));
      client.disconnect();
    } catch (error) {
      console.log(chalk.red('✗ Browser extension is not reachable'));
      console.log(chalk.gray('Make sure the browser extension is active and the helper tab is open'));
      process.exit(1);
    }
  });

program
  .command('pull')
  .description('Pull scope artifacts from ServiceNow')
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .option('-a, --all', 'Include empty artifacts')
  .action(async (options) => {
    const client = new ScriptSyncClient('127.0.0.1', 1978, options.workspace);
    
    try {
      await client.connect();
      await client.requestScopeArtifacts(options.all);
      console.log(chalk.green('✓ Requested scope artifacts'));
      
      // Wait a bit for the response then disconnect
      setTimeout(() => {
        client.disconnect();
        process.exit(0);
      }, 5000);
    } catch (error) {
      console.error(chalk.red('✗ Pull failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('metadata')
  .description('Load instance metadata (tables and properties)')
  .option('-w, --workspace <path>', 'Workspace path', process.cwd())
  .action(async (options) => {
    const client = new ScriptSyncClient('127.0.0.1', 1978, options.workspace);
    
    try {
      await client.connect();
      await client.requestInstanceMetaData();
      console.log(chalk.green('✓ Requested instance metadata'));
      
      // Wait a bit for the response then disconnect
      setTimeout(() => {
        client.disconnect();
        process.exit(0);
      }, 5000);
    } catch (error) {
      console.error(chalk.red('✗ Metadata request failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('open <file>')
  .description('Open a synced file in the ServiceNow instance')
  .action(async (file, options) => {
    const client = new ScriptSyncClient('127.0.0.1', 1978, process.cwd());
    
    try {
      await client.connect();
      const absolutePath = path.resolve(file);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(chalk.red('✗ File not found:'), absolutePath);
        process.exit(1);
      }
      
      await client.openInInstance(absolutePath);
      console.log(chalk.green('✓ Opening file in instance'));
      
      setTimeout(() => {
        client.disconnect();
        process.exit(0);
      }, 2000);
    } catch (error) {
      console.error(chalk.red('✗ Open failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('refresh <file>')
  .description('Refresh a file from the ServiceNow instance')
  .action(async (file, options) => {
    const client = new ScriptSyncClient('127.0.0.1', 1978, process.cwd());
    
    try {
      await client.connect();
      const absolutePath = path.resolve(file);
      
      if (!fs.existsSync(absolutePath)) {
        console.error(chalk.red('✗ File not found:'), absolutePath);
        process.exit(1);
      }
      
      await client.refreshFromInstance(absolutePath);
      console.log(chalk.green('✓ Requested file refresh from instance'));
      
      setTimeout(() => {
        client.disconnect();
        process.exit(0);
      }, 3000);
    } catch (error) {
      console.error(chalk.red('✗ Refresh failed:'), error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program.parse();
