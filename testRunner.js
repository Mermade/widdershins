'use strict';

var fs = require('fs');
var path = require('path');
var rr = require('recursive-readdir');
var yaml = require('js-yaml');
var widdershins = require('./index.js');

var argv = require('yargs')
	.usage('testRunner [options] [{path-to-specs}]')
	.boolean('raw')
	.alias('r','raw')
	.describe('raw','Set widdershins --raw option')
	.count('verbose')
	.alias('v','verbose')
	.describe('verbose','Increase verbosity')
	.help('h')
    .alias('h', 'help')
	.strict()
	.version(function() {
		return require('../package.json').version;
	})
	.argv;

var red = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[31m';
var green = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[32m';
var normal = process.env.NODE_DISABLE_COLORS ? '' : '\x1b[0m';

var pass = 0;
var fail = 0;
var failures = [];

var pathspec = argv._.length>0 ? argv._[0] : '../openapi-directory/APIs/';

var options = argv;
var widdershinsOptions = {};
if (options.raw) widdershinsOptions.sample = false;

function check(file) {
	var result = false;
	var components = file.split(path.sep);

	if ((components[components.length-1] == 'swagger.yaml') || (components[components.length-1] == 'swagger.json')) {
		console.log(normal+file);

		var srcStr = fs.readFileSync(path.resolve(file),'utf8');
		var src;
		if (components[components.length-1] == 'swagger.yaml') {
			src = yaml.safeLoad(srcStr);
		}
		else {
			src = JSON.parse(srcStr);
		}

		try {
	        result = widdershins.convert(src, widdershinsOptions);
			result = result.split('is undefined').join('x');
			if ((result != '') && (result.indexOf('undefined')<0)) {
		    	console.log(green+'  %s %s',src.info.title,src.info.version);
		    	console.log('  %s',src.host);
				result = true;
			}
			else {
				result = false;
			}
		}
		catch (ex) {
			console.log(ex.message);
			console.log(ex.stack);
			result = false;
		}
		if (result) {
			pass++;
		}
		else {
			fail++;
		}
	}
	else {
		result = true;
	}
	return result;
}

process.exitCode = 1;
pathspec = path.resolve(pathspec);
rr(pathspec, function (err, files) {
	for (var i in files) {
		if (!check(files[i])) {
			failures.push(files[i]);
		}
	}
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
