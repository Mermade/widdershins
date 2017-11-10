'use strict';

const util = require('util');
const jptr = require('jgexml/jpath.js');
const sampler = require('openapi-sampler');
const safejson = require('safe-json-stringify');
const visit = require('reftools/lib/visit.js').visit;
const clone = require('reftools/lib/clone.js').clone;
const circularClone = require('reftools/lib/clone.js').circularClone;
const reref = require('reftools/lib/reref.js').reref;
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
    let op = data.operation||data.message;
    if (op && op["x-code-samples"]) {
        for (var c in op["x-code-samples"]) {
            var sample = op["x-code-samples"][c];
            var lang = languageCheck(sample.lang, data.header.language_tabs, true);
            s += '```' + lang + '\n';
            s += sample.source;
            s += '\n```\n';
        }
    }
    else {
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

function inferType(schema) {

    function has(properties) {
        for (let property of properties) {
            if (typeof schema[property] !== 'undefined') return true;
        }
        return false;
    }

    if (schema.type) return schema.type;
    let possibleTypes = [];
    if (has(['properties','additionalProperties','patternProperties','minProperties','maxProperties','required','dependencies'])) {
        possibleTypes.push('object');
    }
    if (has(['items','additionalItems','maxItems','minItems','uniqueItems'])) {
        possibleTypes.push('array');
    }
    if (has(['exclusiveMaximum','exclusiveMinimum','maximum','minimum','multipleOf'])) {
        possibleTypes.push('number');
    }
    if (has(['maxLength','minLength','pattern'])) {
        possibleTypes.push('number');
    }
    if (schema.enum) {
        for (let value of schema.enum) {
            possibleTypes.push(typeof value); // doesn't matter about dupes
        }
    }

    if (possibleTypes.length === 1) return possibleTypes[0];
    return 'any';
}

function schemaToArray(schema,offset,options,data) {
    let iDepth = 0;
    let oDepth = 0;
    let container = [];
    let block = { title: '', rows: [] };
    container.push(block);
    let blockDepth = 0;
    walkSchema(schema,{},{},function(schema,parent,state){

        if (state.property && (state.property.startsWith('allOf') || state.property.startsWith('anyOf') || state.property.startsWith('oneOf') || (state.property === 'not'))) {
            let components = (state.property+'/0').split('/');
            if (components[1] !== '0') {
                if (components[0] === 'allOf') components[0] = 'and';
                if (components[0] === 'anyOf') components[0] = 'or';
                if (components[0] === 'oneOf') components[0] = 'xor';
            }
            block = { title: components[0], rows: [] };
            container.push(block);
            blockDepth = iDepth;
        }
        else {
            if (blockDepth && iDepth < blockDepth) {
                block = { title: 'continued', rows: [] };
                container.push(block);
                blockDepth = 0;
            }
        }

        let entry = {};
        entry.schema = schema;
        entry.in = 'body';
        if (state.property && state.property.indexOf('/')) {
            entry.name = state.property.split('/')[1];
        }
        else if (!state.top) console.warn(state.property);
        if (!entry.name && schema.title) entry.name = schema.title;

        if (schema.type === 'array' && schema.items && schema.items["x-widdershins-oldRef"] && !entry.name) {
            entry.name = data.translations.anonymous;
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
        if (options.trim && typeof entry.description === 'string') {
            entry.description = entry.description.trim();
        }
        if (options.join && typeof entry.description === 'string') {
            entry.description = entry.description.split('\n').join(' ');
        }
        if (entry.description === 'undefined') { // yes, the string
            entry.description = '';
        }
        entry.type = schema.type;
        entry.format = schema.format;

        entry.safeType = entry.type;

        if (schema["x-widdershins-oldRef"]) {
            entry.$ref = schema["x-widdershins-oldRef"].replace('#/components/schemas/','');
            entry.safeType = '['+entry.$ref+'](#schema'+entry.$ref.toLowerCase()+')';
        }
        if (schema.$ref) { // repeat for un-dereferenced schemas
            entry.$ref = schema.$ref.replace('#/components/schemas/','');
            entry.type = '$ref';
            entry.safeType = '['+entry.$ref+'](#schema'+entry.$ref.toLowerCase()+')';
        }

        if (entry.format) entry.safeType = entry.safeType+'('+entry.format+')';
        if ((entry.type === 'array') && schema.items) {
            let itemsType = schema.items.type;
            //console.warn(util.inspect(schema));
            if (schema.items["x-widdershins-oldRef"]) {
                let $ref = schema.items["x-widdershins-oldRef"].replace('#/components/schemas/','');
                itemsType = '['+$ref+'](#schema'+$ref.toLowerCase()+')';
            }
            if (schema.items.$ref) {
                let $ref = schema.items.$ref.replace('#/components/schemas/','');
                itemsType = '['+$ref+'](#schema'+$ref.toLowerCase()+')';
            }
            entry.safeType = '['+itemsType+']';
            //console.warn(entry.safeType);
        }

        entry.required = (parent.required && parent.required.indexOf(entry.name)>=0);
        if (typeof entry.required === 'undefined') entry.required = false;

        if (typeof entry.type === 'undefined') {
            entry.type = inferType(schema);
            entry.safeType = entry.type;
        }

        if (typeof entry.name === 'string' && entry.name.startsWith('x-widdershins-')) {
            entry.name = '';
        }

        if ((!state.top || entry.type !== 'object') && (entry.name)) {
            block.rows.push(entry);
        }
    });
    return container;
}

function clean(obj) {
    if (!obj) return {};
    visit(obj,{},{filter:function(obj,key,state){
        if (!key.startsWith('x-widdershins')) return obj[key];
    }});
    return obj;
}

function getSample(orig,options,samplerOptions,api){
    if (!options.samplerErrors) options.samplerErrors = new Map();
    let obj = circularClone(orig);
    let refs = api; //Object.assign({},api,orig);
    if (options.sample && obj) {
        try {
            var sample = sampler.sample(obj,samplerOptions,refs); // was api
            if (sample && typeof sample.$ref !== 'undefined') {
                //console.warn(util.inspect(obj));
                obj = JSON.parse(safejson(orig));
                sample = sampler.sample(obj,samplerOptions,refs);
            }
            if (typeof sample !== 'undefined') return clean(sample);
        }
        catch (ex) {
            if (!options.samplerErrors.has(ex.message)) {
                console.error('# sampler ' + ex.message);
                options.samplerErrors.set(ex.message,true);
            }
            if (options.verbose) {
                console.error(ex);
            }
            obj = JSON.parse(safejson(orig));
            try {
                sample = sampler.sample(obj,samplerOptions,refs);
                if (typeof sample !== 'undefined') return clean(sample);
            }
            catch (ex) {
                console.warn('# sampler 2nd error ' + ex.message);
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
    doContentType : doContentType,
    languageCheck : languageCheck,
    getCodeSamples : getCodeSamples,
    inferType : inferType,
    clone : clone,
    clean : clean,
    getSample : getSample,
    gfmLink : gfmLink,
    schemaToArray : schemaToArray
};
