# TODO - nvim-snutils Development Roadmap

## ✅ Completed Features

### Phase 1: Basic Sync (DONE)
- [x] Basic project structure with TypeScript
- [x] Node.js bridge script for ServiceNow API calls
- [x] Download functionality for business rules
- [x] SSL certificate handling for dev instances
- [x] File path generation (instance/scope/table/name.field.js)
- [x] Authentication with basic auth
- [x] Error handling and logging

### Tested Successfully:
- [x] Business Rule download from sys_script table
- [x] File structure creation: `dev355738.service-now.com/global/sys_script/`
- [x] Script content preservation and formatting

---

## 🚧 Next Development Steps

### Phase 2: Upload Functionality
- [ ] **Upload script back to ServiceNow**
  - [ ] Implement `uploadScript()` method in ServiceNowClient
  - [ ] Add PUT/PATCH API calls to update record fields
  - [ ] Test upload with modified business rule
  - [ ] Add validation before upload

### Phase 3: Neovim Integration
- [ ] **Vim Commands**
  - [ ] Test `:SNDownload` command in Neovim
  - [ ] Test `:SNUpload` command for current buffer
  - [ ] Add `:SNConfig` for configuration setup
  - [ ] Add `:SNStatus` for connection testing

- [ ] **Configuration Management**
  - [ ] Test config loading from `~/.config/nvim/servicenow.json`
  - [ ] Add interactive config setup
  - [ ] Add config validation

### Phase 4: Extended Script Types
- [ ] **Test other ServiceNow script types:**
  - [ ] Client Scripts (`sys_script_client`)
  - [ ] UI Policies (`sys_ui_policy` - script_true, script_false)
  - [ ] Script Includes (`sys_script_include`)
  - [ ] Service Portal Widgets (`sp_widget` - client_script, server_script, template, css)
  - [ ] Catalog Client Scripts (`catalog_script_client`)

### Phase 5: Enhanced Features
- [ ] **File Watching & Auto-sync**
  - [ ] Watch for local file changes
  - [ ] Auto-upload on save (configurable)
  - [ ] Conflict resolution

- [ ] **Improved UI**
  - [ ] Telescope integration for script browsing
  - [ ] Tree view for ServiceNow structure
  - [ ] Status line integration

### Phase 6: Advanced Features
- [ ] **Multi-instance Support**
  - [ ] Support multiple ServiceNow instances
  - [ ] Instance switching commands

- [ ] **IntelliSense & Autocomplete**
  - [ ] Port ServiceNow API definitions
  - [ ] LSP integration for ServiceNow APIs
  - [ ] Snippet support for common patterns

- [ ] **Batch Operations**
  - [ ] Download entire applications/scopes
  - [ ] Bulk upload changes
  - [ ] Diff comparison with server versions

---

## 🔧 Technical Improvements

### Code Quality
- [ ] Add comprehensive error handling
- [ ] Add unit tests for bridge script
- [ ] Add integration tests
- [ ] Add TypeScript strict mode compliance

### Performance
- [ ] Optimize API calls (batch requests)
- [ ] Add caching for metadata
- [ ] Implement request throttling

### Security
- [ ] Add OAuth 2.0 support
- [ ] Add token-based authentication
- [ ] Secure credential storage

---

## 📝 Documentation

- [ ] Complete API documentation
- [ ] Add troubleshooting guide
- [ ] Create video tutorials
- [ ] Add contribution guidelines

---

## 🐛 Known Issues

1. **SSL Certificate Issues**: Fixed with `rejectUnauthorized: false` for dev instances
2. **Authentication**: Currently basic auth only - consider OAuth for production
3. **Error Messages**: Need more descriptive error messages for API failures

---

## 🎯 Immediate Next Task

**Test Upload Functionality:**
1. Modify the downloaded business rule script
2. Implement and test the upload command
3. Verify changes are reflected in ServiceNow instance

Command to test upload:
```bash
# After modifying the downloaded file
node js/sn-bridge.js upload --instance https://dev355738.service-now.com --username admin --password "PASSWORD" "path/to/script.js" sys_script 595a20fac7211010ed6cdd34f2c2602c script
```
