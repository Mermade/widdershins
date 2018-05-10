'use strict';

const path = require('path');
const util = require('util');

const yaml = require('js-yaml');
const dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = 'data';

const common = require('./common.js');
const dereference = require('reftools/lib/dereference.js').dereference;

let templates;

function preProcessor(api) {
    return api;
}

function convertToToc(source) {
    let resources = {};
    for (let t in source.topics) {
        let topic = source.topics[t];
        for (var m in topic) {
            var message = topic[m];
            var tagName = 'Default';
            if (message.tags && message.tags.length > 0) {
                tagName = message.tags[0].name;
            }
            if (!resources[tagName]) {
                resources[tagName] = {};
                if (source.tags) {
                    for (let t in source.tags) {
                        let tag = source.tags[t];
                        if (tag.name === tagName) {
                            resources[tagName].description = tag.description;
                            resources[tagName].externalDocs = tag.externalDocs;
                        }
                    }
                }
            }
            if (!resources[tagName].topics) resources[tagName].topics = {};
            resources[tagName].topics[t] = { messages: {}, parameters: topic.parameters };
            resources[tagName].topics[t].messages[m] = message;
        }
    }
    return resources;
}

function getParameters(params) {
    for (let p of params) {
        if (!p.in) p.in = 'topic';
        if (typeof p.required === 'undefined') p.required = true;
        p.safeType = p.schema.type;
        p.shortDesc = p.description;
    }
    return params;
}

function convert(api, options, callback) {
    api = preProcessor(api);

    let defaults = {};
    defaults.includes = [];
    defaults.search = true;
    defaults.theme = 'darkula';
    defaults.language_tabs = [{ 'javascript--nodejs': 'Node.JS' },{ 'javascript': 'JavaScript' }, { 'ruby': 'Ruby' }, { 'python': 'Python' }, { 'java': 'Java' }, { 'go': 'Go'}];

    options = Object.assign({},defaults,options);

    let data = {};
    if (options.verbose) console.warn('starting deref',api.info.title);
    data.api = dereference(api,api,{verbose:options.verbose,$ref:'x-widdershins-oldRef'});
    if (options.verbose) console.warn('finished deref');
    data.version = (data.api.info.version.toLowerCase().startsWith('v') ? data.api.info.version : 'v'+data.api.info.version);

    let header = {};
    header.title = api.info.title + ' ' + data.version;

    header.language_tabs = options.language_tabs;
    header.headingLevel = 3;

    header.toc_footers = [];
    if (api.externalDocs) {
        if (api.externalDocs.url) {
            header.toc_footers.push('<a href="' + api.externalDocs.url + '">' + (api.externalDocs.description ? api.externalDocs.description : 'External Docs') + '</a>');
        }
    }
    header.includes = options.includes;
    header.search = options.search;
    header.highlight_theme = options.theme;

    if (typeof templates === 'undefined') {
        templates = dot.process({ path: path.join(__dirname, 'templates', 'asyncapi1') });
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

    let content;
    try {
        content = '---\n'+yaml.safeDump(header)+'\n---\n\n'+
            templates.main(data);
        content = common.removeDupeBlankLines(content);
    }
    catch (ex) {
        return callback(ex);
    }

    callback(null,content);
}

module.exports = {
    convert : convert
};

