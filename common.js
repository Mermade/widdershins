'use strict';

var util = require('util');
var recurse = require('openapi_optimise/common.js').recurse;
var circular = require('openapi_optimise/circular.js');
var jptr = require('jgexml/jpath.js');
var sampler = require('openapi-sampler');
const visit = require('reftools/lib/visit.js').visit;
const clone = require('reftools/lib/clone.js').clone;
const circularClone = require('reftools/lib/clone.js').circularClone;
const walkSchema = require('swagger2openapi/walkSchema').walkSchema;

const MAX_SCHEMA_DEPTH=100;

/* originally from https://github.com/for-GET/know-your-http-well/blob/master/json/status-codes.json */
/* "Unlicensed", public domain */
var statusCodes = require('./statusCodes.json');

// could change these to be regexes...
var xmlContentTypes = ['application/xml', 'text/xml', 'image/svg+xml', 'application/rss+xml', 'application/rdf+xml', 'application/atom+xml', 'application/mathml+xml', 'application/hal+xml'];
var jsonContentTypes = ['application/json; charset=utf-8','application/json', 'text/json', 'application/hal+json', 'application/ld+json', 'application/json-patch+json'];
var yamlContentTypes = ['application/x-yaml', 'text/x-yaml'];
var formContentTypes = ['multipart/form-data', 'application/x-www-form-urlencoded', 'application/octet-stream'];

function nop(obj) {
    return obj;
}

function dereference(obj, circles, api, cloneFunc, aggressive) {
    if (!cloneFunc) cloneFunc = nop;
    let circFunc = circular.hasCircles;
    if (aggressive) circFunc = circular.isCircular;
    while (obj && obj["$ref"] && !circular.isCircular(circles, obj.$ref)) {
        var oRef = obj.$ref;
        obj = cloneFunc(jptr.jptr(api, oRef));
        if (obj === false) console.error('Error dereferencing '+oRef);
        obj["x-widdershins-oldRef"] = oRef;
    }
    var changes = 1;
    while (changes > 0) {
        changes = 0;
        recurse(obj, {}, function (obj, state) {
            if ((state.key === '$ref') && (typeof obj === 'string') && (!circFunc(circles, obj))) {
                state.parents[state.parents.length - 2][state.keys[state.keys.length - 2]] = cloneFunc(jptr.jptr(api, obj));
                state.parents[state.parents.length - 2][state.keys[state.keys.length - 2]]["x-widdershins-oldRef"] = obj;
                if (state.parents[state.parents.length - 2][state.keys[state.keys.length - 2]] === false) console.error('Error dereferencing '+obj);
                delete state.parent["$ref"]; // just in case
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

function getCodeSamples(data) {
    let s = '';
    for (let lang of data.header.language_tabs) {
        let target = lang;
        if (typeof lang === 'object') target = Object.keys(target)[0];
        let lcLang = languageCheck(target,data.header.language_tabs,false);
        var templateName = 'code_' + lcLang.substring(lcLang.lastIndexOf('-') +
1);
        var templateFunc = data.templates[templateName];
        if (templateFunc) {
            s += '```'+lcLang+'\n';
            s += templateFunc(data)+'\n';
            s += '```\n\n';
        }
    }
    return s;
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

function extract(o,parent,seen,depth,callback){
    JSON.stringify(o,function(k,v){
        if (v && v.properties) {
            for (let p in v.properties) {
                var already = seen.indexOf(v.properties[p])>=0;
                if (v.properties[p] && v.properties[p].type === 'array') already = true; // array processing
                if (!already) {
                    let required = false;
                    if (v.required && Array.isArray(v.required)) {
                        required = v.required.indexOf(p)>=0;
                    }
                    let oldRef = '';
                    if (v.properties[p]) {
                        oldRef = v.properties[p]["x-widdershins-oldRef"]||v.properties[p].$ref||'';
                    }
                    let newProp = {};
                    newProp[p] = v.properties[p];
                    callback(newProp,depth,required,oldRef);
                    seen.push(v.properties[p]);
                    if (depth<MAX_SCHEMA_DEPTH) {
                        extract(v.properties[p],p,seen,depth+1,callback);
                    }
                    else {
                        throw new Error('Max schema depth exceeded');
                    }
                 }
            }
        }
        if (v && v.type && v.type === 'array' && v.items) { // array processing
            var name = k||'anonymous';
            var dummy = {};
            dummy.properties = {};
            dummy.properties[name] = v.items;
            dummy.properties[name].description = v.description;
            dummy.properties[name]["x-widdershins-isArray"] = true;
            extract(dummy,k,seen,depth,callback);
        }
        return v;
    });
}

function schemaToArrayOld(schema,depth,lines,trim) {

    if (!schema) schema = {};
    let seen = [];
    extract(schema,'',seen,depth,function(obj,depth,required,oldRef){
        let prefix = '»'.repeat(depth);
        for (let p in obj) {
            if (obj[p]) {
                var prop = {};
                prop.name = (prefix+' '+p).trim();
                prop.in = 'body';
                prop.type = obj[p].type||'Unknown';
                if (obj[p].format) prop.type = prop.type+'('+obj[p].format+')';

                if (((prop.type === 'object') || (prop.type === 'Unknown')) && oldRef) {
                    oldRef = oldRef.split('/').pop();
                    prop.type = '['+oldRef+'](#schema'+gfmLink(oldRef)+')';
                }

                if (obj[p]["x-widdershins-isArray"]) {
                    prop.type = '['+prop.type+']';
                }

                prop.required = required;
                prop.description = (obj[p].description && obj[p].description !== 'undefined') ? obj[p].description : 'No description'; // the actual string 'undefined'
                if (trim && typeof prop.description === 'string') prop.description = prop.description.split('\n').join(' ');
                prop.depth = depth;
                if (obj[p].enum) prop.schema = {enum:obj[p].enum};
                lines.push(prop);
            }
        }
    });
    if (!schema.properties && !schema.items) {
        let prop = {};
        prop.name = schema.title;
        if (!prop.name && schema.type && schema.type !== 'object') prop.name = 'simple';
        if (!prop.name && schema.additionalProperties) prop.name = 'additionalProperties';
        if (!prop.name && schema.patternProperties) prop.name = 'patternProperties';
        prop.description = schema.description||'No description';
        if (trim) prop.description = prop.description.split('\n').join(' ');
        prop.type = schema.type||'Unknown';
        prop.required = false;
        prop.in = 'body';
        if (schema.format) prop.type = prop.type+'('+schema.format+')';
        prop.depth = 0;
        lines.unshift(prop);
    }
}

function schemaToArray(schema,offset,lines,trim) {
    let iDepth = 0;
    let oDepth = 0;
    walkSchema(schema,{},{},function(schema,parent,state){
        let entry = {};
        entry.schema = schema;
        if (state.property && state.property.indexOf('/')) {
            entry.name = state.property.split('/')[1];
        }
        else if (!state.top) console.warn(state.property);
        if (!entry.name && schema.title) entry.name = schema.title;

        if (schema.type === 'array' && schema.items && schema.items["x-widdershins-oldRef"] && !entry.name) {
            entry.name = 'anonymous';
            state.top = false; // force it in
        }

        if (entry.name) {
        if (state.depth > iDepth) {
            oDepth++;
        }
        if (state.depth < iDepth) {
            oDepth--;
            if (oDepth<0) oDepth=0;
        }
        iDepth = state.depth;
        //console.warn('state %s, idepth %s, odepth now %s, offset %s',state.depth,iDepth,oDepth,offset);
        }

        entry.depth = Math.max(oDepth+offset,0);
        //entry.depth = Math.max(oDepth-1,0)/2;
        //if (entry.depth<1) entry.depth = 0;
        entry.displayName = ('»'.repeat(entry.depth)+' '+entry.name).trim();

        entry.description = schema.description;
        if (trim && typeof entry.description === 'string') {
            entry.description = entry.description.trim();
        }
        entry.type = schema.type;
        entry.format = schema.format;

        entry.safeType = entry.type;

        if (schema["x-widdershins-oldRef"]) {
            entry.$ref = schema["x-widdershins-oldRef"].replace('#/components/schemas/','');
            entry.safeType = '['+entry.$ref+'](#schema'+entry.$ref.toLowerCase()+')';
        }

        if (entry.format) entry.safeType = entry.safeType+'('+entry.format+')';
        if ((entry.type === 'array') && schema.items && schema.items.type) {
            let itemsType = schema.items.type;
            //console.warn(util.inspect(schema));
            if (schema.items["x-widdershins-oldRef"]) {
                let $ref = schema.items["x-widdershins-oldRef"].replace('#/components/schemas/','');
                itemsType = '['+$ref+'](#schema'+$ref.toLowerCase()+')';
            }
            entry.safeType = '['+itemsType+']';
            //console.warn(entry.safeType);
        }

        entry.required = (parent.required && parent.required.indexOf(entry.name)>=0);
        if (typeof entry.required === 'undefined') entry.required = false;

        if ((!state.top) && (entry.name)) {
            lines.push(entry);
        }
    });
    return lines;
}

function clean(obj) {
    if (!obj) return {};
    obj = circularClone(obj);
    visit(obj,{},{filter:function(obj,key,state){
        if (!key.startsWith('x-widdershins')) return obj[key];
    }});
    return obj;
}

function getSample(obj,options,samplerOptions,api){
    if (options.sample && obj) {
        try {
            var sample = sampler.sample(obj,samplerOptions,api);
            if (typeof sample !== 'undefined') return sample;
        }
        catch (ex) {
            console.error('# ' + ex);
            if (options.verbose) {
                console.error(ex);
            }
        }
    }
    return clean(obj);
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
    getCodeSamples : getCodeSamples,
    clone : clone,
    clean : clean,
    getSample : getSample,
    gfmLink : gfmLink,
    schemaToArray : schemaToArray
};
