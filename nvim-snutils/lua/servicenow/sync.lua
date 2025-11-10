local M = {}
local config = require('servicenow.config')

-- Execute the Node.js bridge script
local function execute_bridge(action, params)
  local cfg = config.get_config()
  local bridge_path = cfg.bridge_script
  
  -- Build command arguments
  local cmd = { 'node', bridge_path, action }
  
  -- Add config parameters
  table.insert(cmd, '--instance')
  table.insert(cmd, cfg.instance)
  table.insert(cmd, '--username')
  table.insert(cmd, cfg.username)
  table.insert(cmd, '--password')
  table.insert(cmd, cfg.password)
  
  -- Add action-specific parameters
  for _, param in ipairs(params) do
    table.insert(cmd, param)
  end
  
  -- Execute the command
  local result = vim.fn.system(cmd)
  local exit_code = vim.v.shell_error
  
  if exit_code ~= 0 then
    vim.notify("ServiceNow sync error: " .. result, vim.log.levels.ERROR)
    return nil
  end
  
  return result
end

-- Download a script from ServiceNow
function M.download(table_name, sys_id, field_name)
  local params = { table_name, sys_id, field_name }
  local result = execute_bridge('download', params)
  
  if result then
    vim.notify("Downloaded " .. table_name .. "/" .. sys_id .. "/" .. field_name, vim.log.levels.INFO)
    return result
  end
  
  return nil
end

-- Upload current buffer to ServiceNow
function M.upload()
  local current_file = vim.fn.expand('%:p')
  
  if not vim.fn.filereadable(current_file) then
    vim.notify("No file to upload", vim.log.levels.ERROR)
    return
  end
  
  local params = { current_file }
  local result = execute_bridge('upload', params)
  
  if result then
    vim.notify("Uploaded " .. vim.fn.fnamemodify(current_file, ':t'), vim.log.levels.INFO)
  end
end

return M