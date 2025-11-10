local M = {}

-- Plugin configuration
M.config = require('servicenow.config')
M.sync = require('servicenow.sync')

-- Setup function called by user
function M.setup(opts)
  M.config.setup(opts or {})
end

return M