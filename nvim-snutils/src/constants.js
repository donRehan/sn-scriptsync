"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TABLE_MAPPINGS = exports.SERVICENOW_FIELDS = exports.FILE_EXTENSION_MAP = void 0;
exports.FILE_EXTENSION_MAP = {
    'script': 'js',
    'client_script': 'js',
    'condition': 'js',
    'script_true': 'js',
    'script_false': 'js',
    'template': 'xml',
    'html': 'html',
    'css': 'css',
    'link': 'css',
    'client_template': 'html',
    'option_schema': 'js',
    'demo_data': 'js',
    'controller': 'js',
    'controllerAs': 'js',
    'client_controller': 'js',
    'data_policy_scripts': 'js'
};
exports.SERVICENOW_FIELDS = [
    'script', 'client_script', 'condition', 'script_true', 'script_false',
    'template', 'html', 'css', 'link', 'client_template', 'option_schema',
    'demo_data', 'controller', 'controllerAs', 'client_controller', 'data_policy_scripts'
];
exports.TABLE_MAPPINGS = {
    'sys_script': 'business_rules',
    'sys_script_client': 'client_scripts',
    'sp_widget': 'widgets',
    'sp_page': 'pages',
    'sys_ui_policy': 'ui_policies',
    'catalog_script_client': 'catalog_client_scripts'
};
//# sourceMappingURL=constants.js.map