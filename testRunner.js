'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');

var rf = require('node-readfiles');
var yaml = require('js-yaml');
var widdershins = require('./index.js');

var argv = require('yargs')
    .usage('testRunner [options] [{path-to-definitions}]')
    .boolean('noschema')
    .alias('n','noschema')
    .describe('noschema','Set widdershins --noschema option')
    .boolean('raw')
    .alias('r','raw')
    .describe('raw','Set widdershins --raw option')
    .count('verbose')
    .alias('v','verbose')
    .describe('verbose','Increase verbosity')
    .boolean('experimental')
    .alias('x','experimental')
    .describe('experimental','Use experimental v3 templates')
    .help('h')
    .alias('h', 'help')
    .strict()
    .version()
    .argv;

var red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
var yellow = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[33;1m';
var green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
var normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var failures = [];

var genStack = [];

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = argv;
var widdershinsOptions = {};
widdershinsOptions.sample = true;
if (options.raw) widdershinsOptions.sample = false;
if (options.noschema) widdershinsOptions.schema = false;
widdershinsOptions.experimental = options.experimental;
widdershinsOptions.headings = 2;
widdershinsOptions.verbose = options.verbose;
//if (process.env.TRAVIS_NODE_VERSION) {
//    widdershinsOptions.maxDepth = 1;
//}

function genStackNext() {
    if (!genStack.length) return false;
    var gen = genStack.shift();
    setImmediate(() => gen.next());
    return true;
}

function handleResult(file, result) {
    if (result) {
        pass++;
    }
    else {
        fail++;
        failures.push(file);
    }
}

function* check(file) {
    var result = false;
    var components = file.split(path.sep);
    var filename = components[components.length-1];

    if ((filename.endsWith('yaml')) || (filename.endsWith('json'))) {

        if ((file.indexOf('bungie')>=0) && (process.env.TRAVIS_NODE_VERSION)) {
            console.log(yellow+file);
            console.log('Skipping due to size');
            genStackNext();
            return true;
        }

        var srcStr = fs.readFileSync(path.resolve(file),'utf8');
        var src;
        try {
            if (components[components.length-1].endsWith('.yaml')) {
                src = yaml.safeLoad(srcStr);
            }
            else {
                src = JSON.parse(srcStr);
            }
        }
        catch (ex) {
            console.log(normal+file);
            console.log('Could not parse file');
            genStackNext();
            return true;
        }

        if (!src.swagger && !src.openapi && !src.asyncapi && !src.openapiExtensionFormat) {
            console.log(normal+file);
            console.log('Not a known API definition');
            genStackNext();
            return true;
        }

        widdershinsOptions.source = file;
        try {
            widdershins.convert(src, widdershinsOptions, function(err, result){
                let ok = !!result;
                let message = '';
                result = result.split('is undefined').join('x');
                result = result.split('are undefined').join('x');
                result = result.split('be undefined').join('x');
                result = result.split('undefined to').join('x');
                result = result.split('undefined in').join('x');
                result = result.split('undefined how').join('x');
                result = result.split('undefined behavio').join('x');
                result = result.split('"undefined":').join('x');
                result = result.split('undefinedfault').join('x');
                result = result.split('|undefined|[Empty]').join('x');
                result = result.split('efault: undefined').join('x');
                if (ok && result.indexOf('undefined')>=0) {
                    message = 'Ok except for undefined references';
                    ok = false;
                    //console.warn(result);
                }
                if (ok && result.indexOf('x-widdershins-')>=0) {
                    message = 'Ok except for x-widdershins- references';
                    ok = false;
                }
                if ((result != '') && ok) {
                    console.log(normal+file);
                    if (src.info) {
                        console.log(green+'  %s %s',src.info.title,src.info.version);
                        console.log('  %s',src.host||(src.servers && src.servers.length ? src.servers[0].url : null)||'localhost');
                    }
                    else {
                        if (src.openapiExtensionFormat) {
                            console.log(green+'  Semoasa v'+src.openapiExtensionFormat);
                        }
                    }
                    result = true;
                }
                else {
                    console.warn(red+file);
                    if (message) console.warn(message);
                    result = false;
                }
                handleResult(file, result);
            });
        }
        catch (ex) {
            console.log(red+file);
            console.log(red+ex.message);
            result = false;
            handleResult(file, result);
        }
    }
    else {
        result = true;
    }
    genStackNext();
}

process.exitCode = 1;
pathspec = path.resolve(pathspec);

rf(pathspec, { readContents: false, filenameFormat: rf.FULL_PATH }, function (err) {
    if (err) console.log(util.inspect(err));
})
.then(files => {
    files = files.sort();
    for (var file of files) {
        genStack.push(check(file));
    }
    genStackNext();
})
.catch(err => {
    console.log(util.inspect(err));
});

process.on('exit', function(code) {
    if (failures.length>0) {
        failures.sort();
        console.log(red);
        for (var f in failures) {
            console.log(failures[f]);
        }
    }
    console.log(normal);
    console.log('Tests: %s passing, %s failing', pass, fail);
    process.exitCode = ((fail === 0) && (pass > 0)) ? 0 : 1;
});
