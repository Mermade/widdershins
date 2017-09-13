var fs = require('fs');
var yaml = require('js-yaml');
var common = require('./common.js');
var jptr = require('jgexml/jpath.js');

var pairs = [];

function hasRefs(schema) {
	if (schema.$ref) return false;
	var result = false;
	JSON.stringify(schema,function(k,v){
		if (k === '$ref') result = true;
		return v;
	});
	return result;
}

function dumpSchema(schema) {
	let lines = [];
	common.schemaToArray(schema,0,lines,false);
	let pair = {};
	pair.schema = common.clone(schema);
	pair.props = lines;
	pairs.push(pair);
}

if (process.argv.length>2) {
	var filename = process.argv[2];
	var text = fs.readFileSync(filename,'utf8');
	var obj = yaml.safeLoad(text,{json:true});
	JSON.stringify(obj,function(k,v){
		if ((k === 'schema') && (typeof v === 'object')) {
			if (v.$ref) {
				v = jptr.jptr(obj,v.$ref);
			}
			dumpSchema(common.clone(v),obj);
			if (hasRefs(v)) {
				dumpSchema(common.dereference(common.clone(v),[],obj,common.clone),obj);
			}
		}
		else if (((k === 'schemas') || (k === 'definitions')) && (typeof v === 'object')) {
			for (let s in v) {
				if (v[s].$ref) {
					v[s] = jptr.jptr(obj,v[s].$ref);
				}
				dumpSchema(common.clone(v[s]),obj);
				if (hasRefs(v[s])) {
					dumpSchema(common.dereference(common.clone(v[s]),[],obj),obj);
				}
			}
		}
		return v;
	});
	console.log(JSON.stringify(pairs,null,2));
}
