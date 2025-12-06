# Vim Integration for sn-scriptsync

This document provides recommendations for integrating the sn-scriptsync CLI with Vim/Neovim.

## Overview

The CLI tool enables seamless ServiceNow development in Vim by:
1. Running in the background as a daemon
2. Watching for file changes
3. Automatically syncing to ServiceNow
4. Receiving code from the browser extension

## Basic Setup

### 1. Start the CLI in Background

```bash
# Start in background
cd ~/Documents/sn-scriptsync
sn-scriptsync connect &

# Or use tmux/screen for persistent session
tmux new -s sn-scriptsync
sn-scriptsync connect
# Press Ctrl+B, then D to detach
```

### 2. Edit Files in Vim

```bash
vim instance-name/global/sys_script/MyScript.script.js
```

That's it! Changes are automatically synced when you save (`:w`).

## Recommended Vim Plugin Structure

For a more integrated experience, consider creating a Vim plugin:

### Plugin Architecture

```
~/.vim/pack/plugins/start/vim-sn-scriptsync/
├── plugin/
│   └── sn-scriptsync.vim        # Main plugin file
├── autoload/
│   └── sn_scriptsync.vim         # Autoload functions
├── doc/
│   └── sn-scriptsync.txt         # Documentation
└── README.md
```

### Key Features to Implement

#### 1. Connection Management

```vim
" In plugin/sn-scriptsync.vim

" Start/stop CLI from within Vim
command! SNConnect call sn_scriptsync#connect()
command! SNDisconnect call sn_scriptsync#disconnect()
command! SNStatus call sn_scriptsync#status()

" In autoload/sn_scriptsync.vim
function! sn_scriptsync#connect()
  " Start CLI in background
  let l:workspace = expand('%:p:h')
  let l:job = job_start('sn-scriptsync connect --workspace ' . l:workspace)
  echo "Started sn-scriptsync (Job " . l:job . ")"
endfunction
```

#### 2. Quick Commands

```vim
" Open current file in ServiceNow instance
command! SNOpen call sn_scriptsync#open_current()

" Refresh current file from instance
command! SNRefresh call sn_scriptsync#refresh_current()

" Pull all scope artifacts
command! SNPull call sn_scriptsync#pull()

function! sn_scriptsync#open_current()
  let l:file = expand('%:p')
  execute '!sn-scriptsync open "' . l:file . '"'
endfunction
```

#### 3. Status Line Integration

```vim
" Show connection status in statusline
function! SNScriptSyncStatus()
  " Check if CLI is running
  if exists('g:sn_scriptsync_job') && job_status(g:sn_scriptsync_job) == 'run'
    return '[SN:✓]'
  else
    return '[SN:✗]'
  endif
endfunction

" Add to statusline
set statusline+=%{SNScriptSyncStatus()}
```

#### 4. File Type Detection

```vim
" Auto-detect ServiceNow files
augroup sn_scriptsync
  autocmd!
  " Files following pattern: name.field.extension
  autocmd BufRead,BufNewFile *.script.js setfiletype javascript
  autocmd BufRead,BufNewFile *.client_script.js setfiletype javascript
  autocmd BufRead,BufNewFile *.template.html setfiletype html
  autocmd BufRead,BufNewFile *.css.scss setfiletype scss
augroup END
```

#### 5. Keybindings

```vim
" Recommended keybindings
nnoremap <leader>so :SNOpen<CR>
nnoremap <leader>sr :SNRefresh<CR>
nnoremap <leader>sp :SNPull<CR>
nnoremap <leader>sc :SNConnect<CR>
nnoremap <leader>sd :SNDisconnect<CR>
nnoremap <leader>ss :SNStatus<CR>
```

## Neovim Lua Plugin

For Neovim users, here's a modern Lua-based approach:

### Basic Plugin Structure

```lua
-- ~/.config/nvim/lua/sn-scriptsync/init.lua

local M = {}
local job_id = nil

-- Start CLI connection
function M.connect()
  if job_id then
    print("Already connected")
    return
  end
  
  local workspace = vim.fn.expand('%:p:h')
  job_id = vim.fn.jobstart(
    {'sn-scriptsync', 'connect', '--workspace', workspace},
    {
      on_stdout = function(_, data)
        if data then
          print(table.concat(data, '\n'))
        end
      end,
      on_stderr = function(_, data)
        if data then
          vim.api.nvim_err_writeln(table.concat(data, '\n'))
        end
      end,
      on_exit = function()
        job_id = nil
        print("sn-scriptsync disconnected")
      end
    }
  )
  print("Connected to sn-scriptsync")
end

-- Disconnect
function M.disconnect()
  if job_id then
    vim.fn.jobstop(job_id)
    job_id = nil
  end
end

-- Open current file in instance
function M.open_current()
  local file = vim.fn.expand('%:p')
  vim.fn.system('sn-scriptsync open "' .. file .. '"')
end

-- Refresh current file
function M.refresh_current()
  local file = vim.fn.expand('%:p')
  vim.fn.system('sn-scriptsync refresh "' .. file .. '"')
end

-- Pull artifacts
function M.pull()
  vim.fn.system('sn-scriptsync pull')
end

-- Setup commands
function M.setup()
  vim.api.nvim_create_user_command('SNConnect', M.connect, {})
  vim.api.nvim_create_user_command('SNDisconnect', M.disconnect, {})
  vim.api.nvim_create_user_command('SNOpen', M.open_current, {})
  vim.api.nvim_create_user_command('SNRefresh', M.refresh_current, {})
  vim.api.nvim_create_user_command('SNPull', M.pull, {})
  
  -- Keybindings
  vim.keymap.set('n', '<leader>so', M.open_current, { desc = 'SN: Open in instance' })
  vim.keymap.set('n', '<leader>sr', M.refresh_current, { desc = 'SN: Refresh from instance' })
  vim.keymap.set('n', '<leader>sp', M.pull, { desc = 'SN: Pull artifacts' })
end

return M
```

### Usage in init.lua

```lua
-- ~/.config/nvim/init.lua

require('sn-scriptsync').setup()

-- Auto-start when opening ServiceNow files
vim.api.nvim_create_autocmd("BufRead", {
  pattern = "*/sn-scriptsync/*",
  callback = function()
    require('sn-scriptsync').connect()
  end,
})
```

## Advanced Integration Ideas

### 1. Floating Window for Logs

```lua
-- Show CLI output in a floating window
function M.show_logs()
  local buf = vim.api.nvim_create_buf(false, true)
  local width = math.floor(vim.o.columns * 0.8)
  local height = math.floor(vim.o.lines * 0.8)
  
  local win = vim.api.nvim_open_win(buf, true, {
    relative = 'editor',
    width = width,
    height = height,
    col = math.floor((vim.o.columns - width) / 2),
    row = math.floor((vim.o.lines - height) / 2),
    style = 'minimal',
    border = 'rounded'
  })
  
  -- Display CLI logs here
end
```

### 2. Background Script Execution

```lua
-- Execute current buffer as background script
function M.execute_background_script()
  local content = table.concat(vim.api.nvim_buf_get_lines(0, 0, -1, false), '\n')
  -- Send to CLI for execution
  -- This would require adding background script execution to CLI
end
```

### 3. Fuzzy Finding ServiceNow Records

Integration with telescope.nvim or fzf.vim:

```lua
-- Find and open ServiceNow records
function M.find_records()
  local workspace = vim.fn.expand('%:p:h')
  require('telescope.builtin').find_files({
    cwd = workspace,
    find_command = {'fd', '--type', 'f', '--extension', 'js'}
  })
end
```

### 4. Snippet Integration

Create ServiceNow-specific snippets with UltiSnips or LuaSnip:

```vim
" UltiSnips example
snippet grd "GlideRecord"
var gr = new GlideRecord('${1:table}');
gr.addQuery('${2:field}', '${3:value}');
gr.query();
while (gr.next()) {
    ${4:// code}
}
endsnippet
```

## Additional CLI Features Needed for Full Vim Integration

Based on Vim workflows, the following CLI features would be beneficial:

### 1. Background Script Execution

```bash
# Execute a file as a background script
sn-scriptsync execute path/to/script.js --scope global
```

### 2. Interactive Search/Browse

```bash
# List all available records in a table
sn-scriptsync list --table sys_script

# Search for records
sn-scriptsync search "business rule name"
```

### 3. Create New Artifacts

```bash
# Create a new business rule
sn-scriptsync create --type business_rule --name "My New Rule" --table incident
```

### 4. Diff with Instance

```bash
# Compare local file with instance version
sn-scriptsync diff path/to/file.script.js
```

### 5. Log Viewing

```bash
# View sync logs
sn-scriptsync logs

# Follow logs in real-time
sn-scriptsync logs --follow
```

### 6. Multiple Instance Support

```bash
# Connect to specific instance
sn-scriptsync connect --instance dev
sn-scriptsync connect --instance prod

# Switch between instances
sn-scriptsync use prod
```

## Best Practices

### 1. Workspace Organization

```
~/servicenow/
├── dev-instance/
│   └── sn-scriptsync/
│       └── [instance files]
├── test-instance/
│   └── sn-scriptsync/
│       └── [instance files]
└── prod-instance/
    └── sn-scriptsync/
        └── [instance files]
```

### 2. Session Management

Use tmux or screen to manage CLI sessions:

```bash
# Create named session for each instance
tmux new -s sn-dev
cd ~/servicenow/dev-instance/sn-scriptsync
sn-scriptsync connect
# Detach: Ctrl+B, D

# List sessions
tmux ls

# Attach to session
tmux attach -t sn-dev
```

### 3. Git Integration

```bash
# Initialize git in workspace
cd ~/Documents/sn-scriptsync
git init
git add instance-name/global/
git commit -m "Initial commit"

# Use .gitignore
echo "settings.json" >> .gitignore
echo "_map.json" >> .gitignore
echo "*.d.ts" >> .gitignore
```

## Example .vimrc Configuration

Complete example configuration:

```vim
" ServiceNow Development Settings

" Auto-start CLI when opening SN files
augroup sn_scriptsync
  autocmd!
  autocmd BufRead */sn-scriptsync/* call SNAutoConnect()
augroup END

function! SNAutoConnect()
  if !exists('g:sn_scriptsync_connected')
    call sn_scriptsync#connect()
    let g:sn_scriptsync_connected = 1
  endif
endfunction

" Keybindings
nnoremap <leader>so :SNOpen<CR>
nnoremap <leader>sr :SNRefresh<CR>
nnoremap <leader>sp :SNPull<CR>
nnoremap <leader>sm :SNMetadata<CR>

" ServiceNow-specific settings
autocmd FileType javascript setlocal ts=4 sw=4 sts=4 expandtab

" Status line
set statusline+=%{SNScriptSyncStatus()}
```

## Conclusion

The sn-scriptsync CLI provides a solid foundation for Vim integration. The recommended approach is:

1. **Basic Setup**: Use CLI directly with file watching
2. **Enhanced Setup**: Create a simple Vim plugin for convenience commands
3. **Advanced Setup**: Build a full-featured Neovim Lua plugin with telescope integration

The CLI handles the core functionality, while the Vim plugin provides editor-specific conveniences.
