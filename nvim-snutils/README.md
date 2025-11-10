# nvim-snutils

Neovim plugin for ServiceNow script synchronization, based on the VSCode sn-scriptsync extension.

## Prerequisites

- Neovim 0.8+ with Lua support
- Node.js 16+ and npm
- ServiceNow instance with API access

## Installation

### 1. Install the Plugin

Using your favorite plugin manager:

**lazy.nvim:**
```lua
{
  'path/to/nvim-snutils',
  config = function()
    require('servicenow').setup({
      -- Optional configuration
    })
  end
}
```

**packer.nvim:**
```lua
use {
  'path/to/nvim-snutils',
  config = function()
    require('servicenow').setup()
  end
}
```

### 2. Install Node.js Dependencies

Navigate to the plugin directory and install dependencies:

```bash
cd path/to/nvim-snutils
npm install
npm run build
```

### 3. Configure ServiceNow Connection

Create a configuration file at `~/.config/nvim/servicenow.json`:

```json
{
  "instance": "https://your-instance.service-now.com",
  "username": "your-username",
  "password": "your-password",
  "default_scope": "global"
}
```

## Usage

### Commands

- `:SNDownload <table> <sys_id> <field>` - Download a script from ServiceNow
- `:SNUpload` - Upload current buffer to ServiceNow
- `:SNSetup` - Save current configuration

### Examples

#### Business Rules
```vim
" Download a business rule
:SNDownload sys_script 12345678901234567890123456789012 script
```

#### Client Scripts
```vim
" Download a client script
:SNDownload sys_script_client xyz789012345678901234567890xyz script
```

#### Other Script Types
```vim
" UI Policy
:SNDownload sys_ui_policy <sys_id> script_true

" Script Include  
:SNDownload sys_script_include <sys_id> script

" Catalog Client Script
:SNDownload catalog_script_client <sys_id> script

" Service Portal Widget (multiple fields)
:SNDownload sp_widget <sys_id> client_script
:SNDownload sp_widget <sys_id> server_script  
:SNDownload sp_widget <sys_id> template
:SNDownload sp_widget <sys_id> css
```

#### Upload
```vim
" Upload current file (requires sys_id mapping - not fully implemented)
:SNUpload
```

## Current Status

This is a minimal implementation focused on basic script synchronization. Currently supports:

- ✅ Download scripts from ServiceNow
- ❌ Upload scripts to ServiceNow (requires sys_id mapping)
- ❌ Auto-discovery of ServiceNow records
- ❌ Tree view interface
- ❌ Background script execution

## Development

To build the TypeScript files:

```bash
npm run build
# or for development with watch mode
npm run dev
```

## File Structure

```
instance_name/
└── scope_name/
    └── table_name/
        └── record_name.field_name.js
```

### Examples:
- Business Rule: `dev12345.service-now.com/global/sys_script/MyBusinessRule.script.js`
- Client Script: `dev12345.service-now.com/global/sys_script_client/MyClientScript.script.js`
- Widget: `dev12345.service-now.com/global/sp_widget/MyWidget.client_script.js`
- Script Include: `dev12345.service-now.com/global/sys_script_include/MyUtility.script.js`

## Script Type Reference

| Script Type | Table Name | Common Fields | Extension |
|-------------|------------|---------------|-----------|
| Business Rule | `sys_script` | `script` | `.js` |
| Client Script | `sys_script_client` | `script` | `.js` |  
| Script Include | `sys_script_include` | `script` | `.js` |
| UI Policy | `sys_ui_policy` | `script_true`, `script_false` | `.js` |
| Catalog Client Script | `catalog_script_client` | `script` | `.js` |
| Service Portal Widget | `sp_widget` | `client_script`, `server_script`, `template`, `css` | `.js`, `.html`, `.css` |