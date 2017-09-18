#!/usr/bin/env node

'use strict';
var fs = require('fs');
var path = require('path');

var yaml = require('js-yaml');

var converter = require('./index.js');

var argv = require('yargs')
    .usage('widdershins [options] {input-spec} [[-o] output markdown]')
    .demand(1)
    .strict()
    .boolean('yaml')
    .alias('y','yaml')
    .describe('yaml','Load spec in yaml format, default json')
    .boolean('code')
    .alias('c','code')
    .describe('code','Turn generic code samples off')
    .string('includes')
    .boolean('discovery')
    .alias('d','discovery')
    .describe('discovery','Include schema.org WebAPI discovery data')
    .string('environment')
    .alias('e','environment')
    .describe('environment','load config/override options from file')
    .alias('i','includes')
    .describe('includes','List of files to include, comma separated')
    .boolean('lang')
    .alias('l','lang')
    .describe('lang','Automatically generate list of languages for code samples')
    .boolean('noschema')
    .alias('n','noschema')
    .describe('noschema','Do not expand schema definitions')
    .string('outfile')
    .alias('o','outfile')
    .describe('outfile','File to write output markdown to')
    .boolean('raw')
    .alias('r','raw')
    .describe('raw','Output raw schemas not example values')
    .boolean('search')
    .alias('s','search')
    .default('search',true)
    .describe('search','Whether to enable search or not, default true')
    .string('theme')
    .alias('t','theme')
    .describe('theme','Syntax-highlighter theme to use')
    .string('user_templates')
    .alias('u','user_templates')
    .describe('user_templates','directory to load override templates from')
    .help('h')
    .alias('h', 'help')
    .version()
    .argv;

var api = {};
var s = fs.readFileSync(path.resolve(argv._[0]),'utf8');
try {
    api = yaml.safeLoad(s,{json:true});
}
catch(ex) {
    console.error('Failed to parse YAML/JSON, falling back to API Blueprint');
    console.error(ex.message);
    api = s;
}

var options = {};
options.codeSamples = !argv.code;
if (argv.lang) {
    options.language_tabs = [];
}
if (argv.theme) options.theme = argv.theme;
options.user_templates = argv.user_templates;
options.inline = argv.inline;
options.sample = !argv.raw;
options.discovery = argv.discovery;
if (argv.search === false) options.search = false;
if (argv.includes) options.includes = argv.includes.split(',');
if (argv.noschema) options.schema = false;

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

converter.convert(api,options,function(err,output){
    var outfile = argv.outfile||argv._[1];
    if (outfile) {
        fs.writeFileSync(path.resolve(outfile),output,'utf8');
    }
    else {
        console.log(output);
    }
});
