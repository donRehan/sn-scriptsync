" ServiceNow Neovim Plugin Commands

if exists('g:loaded_servicenow')
  finish
endif
let g:loaded_servicenow = 1

" Main commands
command! -nargs=0 SNSetup lua require('servicenow').config.save_config()
command! -nargs=3 SNDownload lua require('servicenow').sync.download(<f-args>)
command! -nargs=0 SNUpload lua require('servicenow').sync.upload()

" Configuration commands
command! -nargs=2 SNConfig lua require('servicenow.config').config[<f-args>]