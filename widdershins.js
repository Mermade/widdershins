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
    .boolean('lang')
    .alias('l','lang')
    .describe('lang','Automatically generate list of languages for code samples')
    .string('outfile')
    .alias('o','outfile')
    .describe('outfile','file to write output markdown to')
    .string('theme')
    .alias('t','theme')
    .describe('theme','Syntax-highlighter theme to use')
	.string('user_templates')
	.alias('u','user_templates')
	.describe('user_templates','directory to load override templates from')
    .help('h')
    .alias('h', 'help')
    .version(function() {
        return require('./package.json').version;
    })
    .argv;

var swagger = {};
if (argv.yaml) {
    var s = fs.readFileSync(path.resolve(argv._[0]),'utf8');
    swagger = yaml.safeLoad(s);
}
else {
    swagger = require(path.resolve(argv._[0]));
}

var options = {};
options.codeSamples = !argv.code;
if (argv.lang) {
	options.language_tabs = [];
}
options.theme = argv.theme;
options.user_templates = argv.user_templates;

var output = converter.convert(swagger,options);

var outfile = argv.outfile||argv._[1];
if (outfile) {
    fs.writeFileSync(path.resolve(outfile),output,'utf8');
}
else {
    console.log(output);
}

