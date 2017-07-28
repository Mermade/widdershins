'use strict';

var util = require('util');
var recurse = require('openapi_optimise/common.js').recurse;
var circular = require('openapi_optimise/circular.js');
var jptr = require('jgexml/jpath.js');

const MAX_SCHEMA_DEPTH=100

/* originally from https://github.com/for-GET/know-your-http-well/blob/master/json/status-codes.json */
/* "Unlicensed", public domain */
var statusCodes = require('./statusCodes.json');

// could change these to be regexes...
var xmlContentTypes = ['application/xml', 'text/xml', 'image/svg+xml', 'application/rss+xml', 'application/rdf+xml', 'application/atom+xml', 'application/mathml+xml', 'application/hal+xml'];
var jsonContentTypes = ['application/json', 'text/json', 'application/hal+json', 'application/ld+json', 'application/json-patch+json'];
var yamlContentTypes = ['application/x-yaml', 'text/x-yaml'];
var formContentTypes = ['multipart/form-data', 'application/x-www-form-urlencoded', 'application/octet-stream'];

function clone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

function dereference(obj, circles, api) {
    while (obj && obj["$ref"] && !circular.isCircular(circles, obj.$ref)) {
        obj = jptr.jptr(api, obj["$ref"]);
    }
    var changes = 1;
    while (changes > 0) {
        changes = 0;
        recurse(obj, {}, function (obj, state) {
            if ((state.key === '$ref') && (typeof obj === 'string') && (!circular.isCircular(circles, obj))) {
                state.parents[state.parents.length - 2][state.keys[state.keys.length - 2]] = jptr.jptr(api, obj);
                delete state.parent["$ref"];
                changes++;
            }
        });
    }
    return obj;
}

function doContentType(types, targets) {
    for (var type in types) {
        for (var target of targets) {
            if (types[type] === target) return true;
        }
    }
    return false;
}

function languageCheck(language, language_tabs, mutate) {
    var lcLang = language.toLowerCase();
    if (lcLang === 'c#') lcLang = 'csharp';
    if (lcLang === 'c++') lcLang = 'cpp';
    for (var l in language_tabs) {
        var target = language_tabs[l];
        if (typeof target === 'object') {
            if (Object.keys(target)[0] === lcLang) {
                return lcLang;
            }
        }
        else {
            if (target === lcLang) return lcLang;
        }
    }
    if (mutate) {
        var newLang = {};
        newLang[lcLang] = language;
        language_tabs.push(newLang);
        return lcLang;
    }
    return false;
}

function gfmLink(text) {
    text = text.trim().toLowerCase();
    text = text.split("'").join('');
    text = text.split('"').join('');
    text = text.split('.').join('');
    text = text.split('`').join('');
    text = text.split(':').join('');
    text = text.split('/').join('');
    text = text.split('&lt;').join('');
    text = text.split('&gt;').join('');
    text = text.split('<').join('');
    text = text.split('>').join('');
    text = text.split(' ').join('-');
    return text;
}

function extract(o,seen,depth,callback){
	JSON.stringify(o,function(k,v){
		if (v && v.properties) {
			for (let p in v.properties) {
				var already = seen.indexOf(v.properties[p])>=0;
				if (!already) {
					let required = false;
					if (v.required) {
						required = v.required.indexOf(p)>=0;
					}
					let newProp = {};
					newProp[p] = v.properties[p];
					callback(newProp,depth,required);
					if (depth<MAX_SCHEMA_DEPTH) {
						extract(v.properties[p],seen,depth+1,callback);
					}
					else {
						throw new Error('Max schema depth exceeded');
					}
					seen.push(v.properties[p]);
				 }
			}
		}
		return v;
	});
}

function schemaToArray(schema,depth,lines) {

	let seen = [];
	extract(schema,seen,0,function(obj,depth,required){
		let prefix = '»'.repeat(depth);
        for (let p in obj) {
			if (obj[p]) {
				var prop = {};
				prop.name = prefix+' '+p;
				prop.in = 'body';
				prop.type = obj[p].type||'Unknown';
				if (obj[p].format) prop.type = prop.type+'('+obj[p].format+')';
				prop.required = required;
				prop.description = obj[p].description||'No description';
				prop.depth = depth;
				if (obj[p].enum) prop.schema = {enum:obj[p].enum};
				lines.push(prop);
			}
		}
	});
	if (!schema.properties) {
		let prop = {};
		prop.name = schema.title||'additionalProperties';
		prop.description = schema.description||'No description';
		prop.type = schema.type||'Unknown';
		prop.required = false;
		if (schema.format) prop.type = prop.type+'('+schema.format+')';
		prop.depth = 0;
		lines.push(prop);
	}
}

module.exports = {
	statusCodes : statusCodes,
	xmlContentTypes : xmlContentTypes,
	jsonContentTypes : jsonContentTypes,
	yamlContentTypes : yamlContentTypes,
	formContentTypes : formContentTypes,
	dereference : dereference,
	doContentType : doContentType,
	languageCheck : languageCheck,
	clone : clone,
	gfmLink : gfmLink,
	schemaToArray : schemaToArray
};
