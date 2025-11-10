local M = {}

local default_config = {
  config_file = vim.fn.expand('~/.config/nvim/servicenow.json'),
  instance = '',
  username = '',
  password = '',
  default_scope = 'global',
  bridge_script = vim.fn.fnamemodify(debug.getinfo(1, "S").source:sub(2), ":p:h:h:h") .. "/js/sn-bridge.js"
}

M.config = default_config

function M.setup(opts)
  M.config = vim.tbl_deep_extend('force', default_config, opts)
  M.load_config()
end

function M.load_config()
  local config_file = M.config.config_file
  if vim.fn.filereadable(config_file) == 1 then
    local content = vim.fn.readfile(config_file)
    local config_str = table.concat(content, '\n')
    local ok, config = pcall(vim.fn.json_decode, config_str)
    if ok then
      M.config = vim.tbl_deep_extend('force', M.config, config)
    end
  end
end

function M.save_config()
  local config_file = M.config.config_file
  local dir = vim.fn.fnamemodify(config_file, ':h')
  vim.fn.mkdir(dir, 'p')
  
  local config_data = {
    instance = M.config.instance,
    username = M.config.username,
    password = M.config.password,
    default_scope = M.config.default_scope
  }
  
  local content = vim.fn.json_encode(config_data)
  vim.fn.writefile(vim.split(content, '\n'), config_file)
end

function M.get_config()
  return M.config
end

return M