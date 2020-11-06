'use strict';

const path = require('path');
const util = require('util');

const yaml = require('yaml');
const dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = 'data';

const common = require('./common.js');
const resolver = require('oas-resolver');
const dereference = require('reftools/lib/dereference.js').dereference;

let templates;

function preProcessor(api) {
    return api;
}

function convertToToc(source) {
    let resources = {};
    for (let c in source.channels) {
        let channel = source.channels[c];
        for (var o of ['publish', 'subscribe']) {
            if(channel[o]) {
                var operation = channel[o];
                var tagName = 'Default';
                if(operation.tags && operation.tags.length > 0) {
                    tagName = operation.tags[0].name;
                }
                if (!resources[tagName]) {
                    resources[tagName] = {};
                    if (source.tags) {
                        for (let tag of source.tags) {
                            if (tag.name === tagName) {
                                resources[tagName].description = tag.description;
                                resources[tagName].externalDocs = tag.externalDocs;
                            }
                        }
                    }
                }
                if(!resources[tagName].channels) resources[tagName].channels = {};
                if(!resources[tagName].channels[c]) resources[tagName].channels[c] = {
                    summary: channel.summary,
                    description: channel.description,
                    parameters: channel.parameters,
                    bindings: channel.bindings,
                    operations: {}
                };
                resources[tagName].channels[c].operations[o] = operation;
            }
        }
    }
    console.log(resources)
    return resources;
}

function getParameters(params) {
    for (let p of params) {
        if (p === false) p = { schema: {} }; // for external $refs when resolve not true
        if (!p.in) p.in = 'topic';
        if (typeof p.required === 'undefined') p.required = true;
        p.safeType = p.schema.type;
        p.shortDesc = p.description;
    }
    return params;
}

function convertInner(api, options) {
    return new Promise(function (resolve, reject) {
        let data = {};
        if (options.verbose) console.warn('starting deref', api.info.title);
        data.api = dereference(api, api, { verbose: options.verbose, $ref: 'x-widdershins-oldRef' });
        if (options.verbose) console.warn('finished deref');
        data.version = (data.api.info && data.api.info.version && data.api.info.version.toLowerCase().startsWith('v') ? data.api.info.version : 'v' + (data.api.info && data.api.info.version ? data.api.info.version : '1.0.0'));
        data.widdershins = require('../package.json');

        let header = {};
        header.title = api.info && api.info.title ? ' ' + data.version : ' 1.0.0';

        header.language_tabs = options.language_tabs;
        header.headingLevel = Math.max(options.headings || 0, 3);

        header.toc_footers = [];
        if (api.externalDocs) {
            if (api.externalDocs.url) {
                header.toc_footers.push('<a href="' + api.externalDocs.url + '">' + (api.externalDocs.description ? api.externalDocs.description : 'External Docs') + '</a>');
            }
        }
        if (options.toc_footers) {
            for (var key in options.toc_footers) {
                header.toc_footers.push('<a href="' + options.toc_footers[key].url + '">' + options.toc_footers[key].description + '</a>');
            }
        }
        header.includes = options.includes;
        header.search = options.search;
        header.highlight_theme = options.theme;
        header.generator = data.widdershins.name+' v'+data.widdershins.version;

        if (typeof templates === 'undefined') {
            templates = dot.process({ path: path.join(__dirname, '..', 'templates', 'asyncapi2') });
        }
        if (options.user_templates) {
            templates = Object.assign(templates, dot.process({ path: options.user_templates }));
        }

        data.options = options;
        data.header = header;
        data.templates = templates;
        data.translations = {};
        templates.translations(data);
        data.resources = convertToToc(data.api);

        data.utils = {};
        data.utils.inspect = util.inspect;
        data.utils.yaml = yaml;
        data.utils.getSample = common.getSample;
        data.utils.getParameters = getParameters;
        data.utils.schemaToArray = common.schemaToArray;
        data.utils.getCodeSamples = common.getCodeSamples;
        data.utils.slugify = common.slugify;

        let content = '';
        try {
            if (!options.omitHeader) content += '---\n' + yaml.stringify(header) + '\n---\n\n';
            content += templates.main(data);
            content = common.removeDupeBlankLines(content);
        }
        catch (ex) {
            return reject(ex);
        }
        content = common.removeDupeBlankLines(content);

        if (options.html) content = common.html(content, header, options);

        resolve(content);
    });
}

function fakeEventParameter(data) {
    if (!data.parameters) data.parameters = [];
    let bodyParams = [];
    if (data.bodyParameter.schema) {
        let param = {};
        param.in = 'body';
        param.schema = data.bodyParameter.schema;
        param.name = 'body';
        if (data.operation.requestBody) {
            param.required = data.operation.requestBody.required || false;
            param.description = data.operation.requestBody.description;
            if (data.options.useBodyName && data.operation['x-body-name']) {
                param.name = data.operation['x-body-name'];
            }
        }
        param.refName = data.bodyParameter.refName;
        if (!data.options.omitBody || param.schema["x-widdershins-oldRef"]) {
            bodyParams.push(param);
        }

        if ((param.schema.type === 'object') && (data.options.expandBody || (!param.schema["x-widdershins-oldRef"]))) {
            let offset = (data.options.omitBody ? -1 : 0);
            let props = common.schemaToArray(data.bodyParameter.schema, offset, { trim: true }, data);

            for (let block of props) {
                for (let prop of block.rows) {
                    let param = {};
                    param.in = 'body';
                    param.schema = prop.schema;
                    param.name = prop.displayName;
                    param.required = prop.required;
                    param.deprecated = prop.deprecated;
                    param.description = prop.description;
                    param.safeType = prop.safeType;
                    param.depth = prop.depth;
                    bodyParams.push(param);
                }
            }
        }

        if (!data.parameters || !Array.isArray(data.parameters)) data.parameters = [];
        data.parameters = data.parameters.concat(bodyParams);
    }
}


function convert(api, options) {
    api = preProcessor(api);

    let defaults = {};
    defaults.includes = [];
    defaults.search = true;
    defaults.theme = 'darkula';
    defaults.language_tabs = [{ 'javascript--nodejs': 'Node.JS' }, { 'javascript': 'JavaScript' }, { 'ruby': 'Ruby' }, { 'python': 'Python' }, { 'java': 'Java' }, { 'go': 'Go' }];
    defaults.sample = true;

    options = Object.assign({}, defaults, options);
    options.openapi = api;

    return resolver.optionalResolve(options)
        .then(function (options) {
            return convertInner(options.openapi, options);
        })
        .catch(function (ex) {
            throw ex;
        });
}

module.exports = {
    convert: convert
};

