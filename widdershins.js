#!/usr/bin/env node

'use strict';
const fs = require('fs');
const path = require('path');
const url = require('url');

const yaml = require('js-yaml');
const fetch = require('node-fetch');

const converter = require('./index.js');

var argv = require('yargs')
    .usage('widdershins [options] {input-file|url} [[-o] output markdown]')
    .demand(1)
    .strict()
    .boolean('code')
    .alias('c','code')
    .describe('code','Turn generic code samples off')
    .string('customApiKeyValue')
    .describe('customApiKeyValue','Set a custom API key value')
    .string('includes')
    .boolean('discovery')
    .alias('d','discovery')
    .describe('discovery','Include schema.org WebAPI discovery data')
    .string('environment')
    .alias('e','environment')
    .describe('environment','Load config/override options from file')
    .boolean('expandBody')
    .describe('expandBody','Expand requestBody properties in parameters')
    .number('headings')
    .describe('headings','Levels of headings to expand in TOC')
    .default('headings',2)
    .boolean('httpsnippet')
    .default('httpsnippet',false)
    .describe('httpsnippet','Use httpsnippet to generate code samples')
    .alias('i','includes')
    .describe('includes','List of files to include, comma separated')
    .boolean('lang')
    .alias('l','lang')
    .describe('lang','Automatically generate list of languages for code samples')
    .array('language_tabs')
    .describe('language_tabs', 'List of language tabs for code samples using "language[:label[:client]]" format, for example: "javascript:JavaScript:request"')
    .number('maxLevel')
    .alias('m','maxDepth')
    .describe('maxDepth','Maximum depth for schema examples')
    .default('maxDepth',10)
    .boolean('omitBody')
    .describe('omitBody','Omit top-level fake body parameter object')
    .string('outfile')
    .alias('o','outfile')
    .describe('outfile','File to write output markdown to')
    .boolean('raw')
    .alias('r','raw')
    .describe('raw','Output raw schemas not example values')
    .boolean('resolve')
    .describe('resolve','Resolve external $refs')
    .boolean('search')
    .alias('s','search')
    .default('search',true)
    .describe('search','Whether to enable search or not, default true')
    .boolean('shallowSchemas')
    .describe('shallowSchemas',"Don't expand schemas past $refs")
    .boolean('summary')
    .describe('summary','Use summary instead of operationId for TOC')
    .string('theme')
    .alias('t','theme')
    .describe('theme','Syntax-highlighter theme to use')
    .string('user_templates')
    .alias('u','user_templates')
    .describe('user_templates','directory to load override templates from')
    .boolean('verbose')
    .alias('v','verbose')
    .describe('verbose','Increase verbosity')
    .boolean('experimental')
    .alias('x','experimental')
    .describe('experimental','For backwards compatibility only, ignored')
    .boolean('yaml')
    .alias('y','yaml')
    .describe('yaml','Display JSON schemas in YAML format')
    .help('h')
    .alias('h','help')
    .version()
    .argv;

var options = {};

function doit(s) {
    var api = {};
    try {
        api = yaml.safeLoad(s,{json:true});
    }
    catch(ex) {
        console.error('Failed to parse YAML/JSON, falling back to API Blueprint');
        console.error(ex.message);
        api = s;
    }

    converter.convert(api,options,function(err,output){
        if (err) {
            console.warn(err);
        }
        else {
            var outfile = argv.outfile||argv._[1];
            if (outfile) {
                fs.writeFileSync(path.resolve(outfile),output,'utf8');
            }
            else {
                console.log(output);
            }
        }
    });
}

options.codeSamples = !argv.code;
options.httpsnippet = argv.httpsnippet;
if (argv.lang) {
    options.language_tabs = [];
}
else if (argv.language_tabs) {
    const languages = argv.language_tabs
        .reduce((languages, item) => {
            const [lang, name, client] = item.split(':', 3);

            languages.language_tabs.push({ [lang]: name || lang });
            languages.language_clients[lang] = client || '';

            return languages;
        }, { language_tabs: [], language_clients: []});
    options.language_tabs = languages.language_tabs;
    options.language_clients = languages.language_clients;
}
if (argv.theme) options.theme = argv.theme;
options.user_templates = argv.user_templates;
options.inline = argv.inline;
options.sample = !argv.raw;
options.discovery = argv.discovery;
options.verbose = argv.verbose;
options.tocSummary = argv.summary;
options.headings = argv.headings;
options.experimental = argv.experimental;
options.resolve = argv.resolve;
options.expandBody = argv.expandBody;
options.maxDepth = argv.maxDepth;
options.omitBody = argv.omitBody;
options.shallowSchemas = argv.shallowSchemas;
options.yaml = argv.yaml;
options.customApiKeyValue = argv.customApiKeyValue;
if (argv.search === false) options.search = false;
if (argv.includes) options.includes = argv.includes.split(',');

if (argv.environment) {
    var e = fs.readFileSync(path.resolve(argv.environment),'utf8');
    var env = {};
    try {
        env = yaml.safeLoad(e,{json:true});
    }
    catch (ex) {
        console.error(ex.message);
    }
    options = Object.assign({},options,env);
}

var input = argv._[0];
options.source = input;
var up = url.parse(input);
if (up.protocol && up.protocol.startsWith('http')) {
    fetch(input)
    .then(function (res) {
        return res.text();
    }).then(function (body) {
        doit(body);
    }).catch(function (err) {
        console.error(err.message);
    });
}
else {
    let s = fs.readFileSync(input,'utf8');
    doit(s);
}

