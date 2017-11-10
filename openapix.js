'use strict';

const path = require('path');
const util = require('util');
const up = require('url');

const yaml = require('js-yaml');
const safejson = require('safe-json-stringify');
const uri = require('urijs');
const URITemplate = require('urijs/src/URITemplate')
const dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = 'data';

const xml = require('jgexml/json2xml.js');
const jptr = require('reftools/lib/jptr.js').jptr;
const dereference = require('reftools/lib/dereference.js').dereference;
const clone = require('reftools/lib/clone.js').clone;
const swagger2openapi = require('swagger2openapi');

const common = require('./common.js');

let templates;

function convertToToc(source,data) {
    let resources = {};
    for (var p in source.paths) {
        for (var m in source.paths[p]) {
            if ((m !== 'parameters') && (m !== 'summary') && (m !== 'description') && (!m.startsWith('x-'))) {
                var method = {};
                method.operation = source.paths[p][m];
                method.pathItem = source.paths[p];
                method.verb = m;
                method.path = p;
                method.pathParameters = source.paths[p].parameters;
                var sMethodUniqueName = (method.operation.operationId ? method.operation.operationId : m + '_' + p).split('/').join('_');
                sMethodUniqueName = sMethodUniqueName.split(' ').join('_'); // TODO {, } and : ?
                if (data.options.tocSummary && method.operation.summary) {
                    sMethodUniqueName = method.operation.summary;
                }
                var tagName = data.translations.defaultTag;
                if (method.operation.tags && method.operation.tags.length > 0) {
                    tagName = method.operation.tags[0];
                }
                if (!resources[tagName]) {
                    resources[tagName] = {};
                    if (source.tags) {
                        for (var t in source.tags) {
                            var tag = source.tags[t];
                            if (tag.name === tagName) {
                                resources[tagName].description = tag.description;
                                resources[tagName].externalDocs = tag.externalDocs;
                            }
                        }
                    }
                }
                if (!resources[tagName].methods) resources[tagName].methods = {};
                resources[tagName].methods[sMethodUniqueName] = method;
            }
        }
    }
    return resources;
}

function fakeProdCons(data) {
    data.produces = [];
    data.consumes = [];
    data.bodyParameter = {};
    data.bodyParameter.exampleValues = {};
    for (var r in data.operation.responses) {
        var response = data.operation.responses[r];
        for (var prod in response.content) {
            data.produces.push(prod);
        }
    }
    let op = data.method.operation;
    if (op.requestBody) {
        for (var rb in op.requestBody.content) {
            data.consumes.push(rb);
            if (!data.bodyParameter.exampleValues.object) {
                data.bodyParameter.present = true;
                data.bodyParameter.contentType = rb;
                if (op.requestBody["x-widdershins-oldRef"]) {
                    data.bodyParameter.refName = op.requestBody["x-widdershins-oldRef"].replace('#/components/requestBodies/','');
                }
                data.bodyParameter.schema = op.requestBody.content[rb].schema;
                data.bodyParameter.exampleValues.object = common.getSample(op.requestBody.content[rb].schema,data.options,{},data.api);
                if (typeof data.bodyParameter.exampleValues.object === 'object') {
                    data.bodyParameter.exampleValues.json = safejson(data.bodyParameter.exampleValues.object,null,2);
                }
                else {
                    data.bodyParameter.exampleValues.json = data.bodyParameter.exampleValues.object;
                }
            }
        }
    }
}

function getParameters(data) {

    function stupidity(varname) {
        let s = encodeURIComponent(varname);
        s = s.split('-').join('%2D');
        s = s.split('$').join('%24');
        s = s.split('.').join('%2E');
        return s;
    }

    data.allHeaders = [];
    data.headerParameters = [];
    data.requiredParameters = [];
    let uriTemplateStr = data.method.path.split('/ /').join('/+/');
    let requiredUriTemplateStr = uriTemplateStr;
    var templateVars = {};

    if (data.consumes.length) {
        var contentType = {};
        contentType.name = 'Content-Type';
        contentType.type = 'string';
        contentType.in = 'header';
        contentType.exampleValues = {};
        contentType.exampleValues.json = "'" + data.consumes[0] + "'";
        contentType.exampleValues.object = data.consumes[0];
        data.allHeaders.push(contentType);
    }
    if (data.produces.length) {
        var accept = {};
        accept.name = 'Accept';
        accept.type = 'string';
        accept.in = 'header';
        accept.exampleValues = {};
        accept.exampleValues.json = "'" + data.produces[0] + "'";
        accept.exampleValues.object = data.produces[0];
        data.allHeaders.push(accept);
    }
    if (!Array.isArray(data.parameters)) data.parameters = [];
    data.longDescs = false;
    for (let param of data.parameters) {
        //var temp = '';
        param.exampleValues = {};
        if (!param.required) param.required = false;
        if (param.schema && !param.safeType) {
            param.originalType = param.schema.type;
            param.safeType = param.schema.type || common.inferType(param.schema);
            if (param.schema.format) {
                param.safeType = param.safeType+'('+param.schema.format+')';
            }
            if ((param.safeType === 'array') && (param.schema.items)) {
                let itemsType = param.schema.items.type;
                if (!itemsType) {
                    itemsType = common.inferType(param.schema.items);
                }
                param.safeType = 'array['+itemsType+']';
            }
            if (param.schema["x-widdershins-oldRef"]) {
                let schemaName = param.schema["x-widdershins-oldRef"].replace('#/components/schemas/','');
                param.safeType = '['+schemaName+'](#schema'+schemaName.toLowerCase()+')';
            }
            if (param.refName) param.safeType = '['+param.refName+'](#schema'+param.refName.toLowerCase()+')';
        }
        if (param.schema) {
            param.exampleValues.object = param.example || param.default || common.getSample(param.schema,data.options,{},data.api);
            if (typeof param.exampleValues.object === 'object') {
                param.exampleValues.json = safejson(param.exampleValues.object,null,2);
            }
            else {
                param.exampleValues.json = "'"+param.exampleValues.object+"'";
            }
        }
        if (param.description === 'undefined') { // yes, the string
            param.description = '';
        }
        if (typeof param.description !== 'undefined') {
            param.shortDesc = param.description.split('\n')[0];
            if (param.shortDesc !== param.description) data.longDescs = true;
        }

        if (param.in === 'cookie') {
            if (!param.style) param.style = 'form';
            // style prefixes: form
        }
        if (param.in === 'header') {
            if (!param.style) param.style = 'simple';
            data.headerParameters.push(param);
            data.allHeaders.push(param);
        }
        if (param.in === 'path') {
            let template = param.allowReserved ? '{+' : '{';
            // style prefixes: matrix, label, simple
            if (!param.style) param.style = 'simple';
            if (param.style === 'label') template += '.';
            if (param.style === 'matrix') template += ';';
            template += stupidity(param.name);
            template += param.explode ? '*}' : '}';
            uriTemplateStr = uriTemplateStr.split('{'+param.name+'}').join(template);
            requiredUriTemplateStr = requiredUriTemplateStr.split('{'+param.name+'}').join(template);
        }
        if (param.in === 'query') {
            let template = param.allowReserved ? '{?' : '{?'; // FIXME +
            // style prefixes: form, spaceDelimited, pipeDelimited, deepObject
            if (!param.style) param.style = 'form';
            template += stupidity(param.name);
            template += param.explode ? '*}' : '}';
            uriTemplateStr += template;
            if (param.required) {
                requiredUriTemplateStr += template;
                data.requiredParameters.push(param);
            }
        }
        templateVars[stupidity(param.name)] = param.exampleValues.object;
    }

    let uriTemplate = new URITemplate(uriTemplateStr);
    let requiredUriTemplate = new URITemplate(requiredUriTemplateStr);
    data.uriExample = uriTemplate.expand(templateVars);
    data.requiredUriExample = requiredUriTemplate.expand(templateVars);

    //TODO deconstruct and reconstruct to cope w/ spaceDelimited/pipeDelimited

    data.queryString = data.uriExample.substr(data.uriExample.indexOf('?'));
    if (!data.queryString.startsWith('?')) data.queryString = '';
    data.queryString = data.queryString.split('%25').join('%');
    data.requiredQueryString = data.requiredUriExample.substr(data.requiredUriExample.indexOf('?'));
    if (!data.requiredQueryString.startsWith('?')) data.requiredQueryString = '';
    data.requiredQueryString = data.requiredQueryString.split('%25').join('%');

}

function getBodyParameterExamples(data) {
    let obj = data.bodyParameter.exampleValues.object;
    let content = '';
    let xmlWrap = false;
    if (data.bodyParameter.schema && data.bodyParameter.schema.xml) {
        xmlWrap = data.bodyParameter.schema.xml.name;
    }
    if (common.doContentType(data.consumes, common.jsonContentTypes)) {
        content += '```json\n';
        content += safejson(obj,null,2) + '\n';
        content += '```\n';
    }
    if (common.doContentType(data.consumes, common.yamlContentTypes)) {
        content += '```yaml\n';
        content += yaml.safeDump(obj) + '\n';
        content += '```\n';
    }
    if (common.doContentType(data.consumes, common.formContentTypes)) {
        content += '```yaml\n';
        content += yaml.safeDump(obj) + '\n';
        content += '```\n';
    }
    if (common.doContentType(data.consumes, common.xmlContentTypes) && (typeof obj === 'object')) {
        if (xmlWrap) {
            var newObj = {};
            newObj[xmlWrap] = obj;
            obj = newObj;
        }
        content += '```xml\n';
        content += xml.getXml(JSON.parse(safejson(obj)), '@', '', true, '  ', false) + '\n';
        content += '```\n';
    }
    return content;
}

function fakeBodyParameter(data) {
    if (!data.parameters) data.parameters = [];
    let bodyParams = [];
    if (data.bodyParameter.schema) {
        let param = {};
        param.in = 'body';
        param.schema = data.bodyParameter.schema;
        param.name = 'body';
        param.required = data.operation.requestBody.required || false;
        param.description = data.operation.requestBody.description;
        param.refName = data.bodyParameter.refName;
        bodyParams.push(param);

        if ((param.schema.type === 'object') && (data.options.expandBody || (!param.schema["x-widdershins-oldRef"]))) {
            let props = common.schemaToArray(data.bodyParameter.schema,0,{trim:true},data);

            for (let block of props) {
                for (let prop of block.rows) {
                    let param = {};
                    param.in = 'body';
                    param.schema = prop.schema;
                    param.name = prop.displayName;
                    param.required = prop.required;
                    param.description = prop.description;
                    param.safeType = prop.safeType;
                    bodyParams.push(param);
                }
            }
        }

        data.parameters = data.parameters.concat(bodyParams);
    }
}

function mergePathParameters(data) {
    if (!data.parameters) data.parameters = [];
    data.parameters = data.parameters.concat(data.method.pathParameters||[]);
    data.parameters = data.parameters.filter((param, index, self) => self.findIndex((p) => {return p.name === param.name && p.in === param.in; }) === index);
}

function getResponses(data) {
    let responses = [];
    for (let r in data.operation.responses) {
        let response = data.operation.responses[r];
        let entry = {};
        entry.status = r;
        entry.meaning = (r === 'default' ? data.translations.responseDefault : data.translations.responseUnknown);
        var url = '';
        for (var s in common.statusCodes) {
            if (common.statusCodes[s].code === r) {
                entry.meaning = common.statusCodes[s].phrase;
                url = common.statusCodes[s].spec_href;
                break;
            }
        }
        if (url) entry.meaning = '[' + entry.meaning + '](' + url + ')';
        entry.description = response.description;
        entry.description = entry.description.trim();
        entry.schema = response.content ? data.translations.schemaInline : data.translations.schemaNone;
        for (let ct in response.content) {
            let contentType = response.content[ct];
            if (contentType.schema) entry.type = contentType.schema.type;
            if (contentType.schema && contentType.schema["x-widdershins-oldRef"]) {
                let schemaName = contentType.schema["x-widdershins-oldRef"].replace('#/components/schemas/','');
                entry.schema = '['+schemaName+'](#schema'+schemaName.toLowerCase()+')';
                entry.$ref = true;
            }
            else {
                if (contentType.schema && contentType.schema.type && (contentType.schema.type !== 'object') && (contentType.schema.type !== 'array')) {
                    entry.schema = contentType.schema.type;
                }
            }
        }
        entry.content = response.content;
        entry.links = response.links;
        responses.push(entry);
    }
    return responses;
}

function getResponseExamples(data) {
    let content = '';
    for (var resp in data.operation.responses) {
        var response = data.operation.responses[resp];
        for (var ct in response.content) {
            var contentType = response.content[ct];
            var cta = [ct];
            if (contentType.schema) {
                var xmlWrap = '';
                var obj = contentType.schema;
                if (obj && obj.xml && obj.xml.name) {
                    xmlWrap = obj.xml.name;
                }
                if (Object.keys(obj).length > 0) {
                    // support embedded examples
                    if (contentType.examples) {
                        obj = common.clean(contentType.examples[Object.keys(contentType.examples)[0]]);
                    }
                    else if (contentType.example) {
                        obj = common.clean(contentType.example);
                    }
                    else {
                        obj = common.getSample(obj,data.options,{},data.api);
                    }
                    if (common.doContentType(cta, common.jsonContentTypes)) {
                        content += '```json\n';
                        content += safejson(obj, null, 2) + '\n';
                        content += '```\n';
                    }
                    if (common.doContentType(cta, common.yamlContentTypes)) {
                        content += '```yaml\n';
                        content += yaml.safeDump(obj) + '\n';
                        content += '```\n';
                    }
                    if (xmlWrap) {
                        var newObj = {};
                        newObj[xmlWrap] = obj;
                        obj = newObj;
                    }
                    if ((typeof obj === 'object') && common.doContentType(cta, common.xmlContentTypes)) {
                        content += '```xml\n';
                        content += xml.getXml(JSON.parse(safejson(obj)), '@', '', true, '  ', false) + '\n';
                        content += '```\n';
                    }
                }
            }
        }
    }
    return content;
}

function getResponseHeaders(data) {
    let headers = [];
    for (let r in data.operation.responses) {
        let response = data.operation.responses[r];
        if (response.headers) {
            for (let h in response.headers) {
                let header = response.headers[h];
                let entry = {};
                entry.status = r;
                entry.header = h;
                entry.description = header.description;
                entry.in = 'header';
                entry.required = header.required;
                entry.schema = header.schema || {};
                entry.type = entry.schema.type;
                entry.format = entry.schema.format;
                headers.push(entry);
            }
        }
    }
    return headers;
}

function getAuthenticationStr(data) {
    var list = '';
    for (var s in data.security) {
        var link;
        link = '#/components/securitySchemes/' + Object.keys(data.security[s])[0];
        var secDef = jptr(data.api, link);
        list += (list ? ', ' : '') + (secDef ? secDef.type : data.translations.secDefNone);
        var scopes = data.security[s][Object.keys(data.security[s])[0]];
        if (Array.isArray(scopes) && (scopes.length > 0)) {
            list += ' ( '+data.translations.secDefScopes+': ';
            for (var scope in scopes) {
                list += scopes[scope] + ' ';
            }
            list += ')';
        }
    }
    return list;
}

function convertInner(api, options, callback) {
    let defaults = {};
    defaults.title = 'API';
    defaults.language_tabs = [{ 'shell': 'Shell' }, { 'http': 'HTTP' }, { 'javascript': 'JavaScript' }, { 'javascript--nodejs': 'Node.JS' }, { 'ruby': 'Ruby' }, { 'python': 'Python' }, { 'java': 'Java' }];
    defaults.toc_footers = [];
    defaults.includes = [];
    defaults.search = true;
    defaults.theme = 'darkula';
    defaults.headingLevel = 2;

    options = Object.assign({},defaults,options);

    let data = {};
    if (options.verbose) console.log('starting deref',api.info.title);
    if (api.components) {
        data.components = clone(api.components);
    }
    else {
        data.components = {};
    }
    data.api = dereference(api,api,{verbose:options.verbose,$ref:'x-widdershins-oldRef'});
    if (options.verbose) console.log('finished deref');

    if (data.api.components && data.api.components.schemas && data.api.components.schemas["x-widdershins-oldRef"]) {
        delete data.api.components.schemas["x-widdershins-oldRef"];
    }

    if (typeof templates === 'undefined') {
        templates = dot.process({ path: path.join(__dirname, 'templates', 'openapix') });
    }
    if (options.user_templates) {
        templates = Object.assign(templates, dot.process({ path: options.user_templates }));
    }
    data.translations = {};
    templates.translations(data);

    data.version = (data.api.info.version.toLowerCase().startsWith('v') ? data.api.info.version : 'v'+data.api.info.version);

    let header = {};
    header.title = api.info.title + ' ' + data.version;
    header.language_tabs = options.language_tabs;
    header.toc_footers = [];
    if (api.externalDocs) {
        if (api.externalDocs.url) {
            header.toc_footers.push('<a href="' + api.externalDocs.url + '">' + (api.externalDocs.description ? api.externalDocs.description : data.translations.externalDocs) + '</a>');
        }
    }
    header.includes = options.includes;
    header.search = options.search;
    header.highlight_theme = options.theme;
    header.headingLevel = options.headings;

    data.options = options;
    data.header = header;
    data.title_prefix = data.api.info.title.split(' ').join('-');
    data.templates = templates;
    data.resources = convertToToc(api,data);
    //console.warn(util.inspect(data.resources));

    if (data.api.servers && data.api.servers.length) {
        data.servers = data.api.servers;
    }
    else if (options.loadedFrom) {
        data.servers = [{url:options.loadedFrom}];
    }
    else {
        data.servers = [{url:'//'}];
    }
    data.host = up.parse(data.servers[0].url).host;
    data.protocol = up.parse(data.servers[0].url).protocol;
    if (data.protocol) data.protocol = data.protocol.replace(':','');
    data.baseUrl = data.servers[0].url;

    data.utils = {};
    data.utils.yaml = yaml;
    data.utils.inspect = util.inspect;
    data.utils.safejson = safejson;
    data.utils.isPrimitive = function(t) { return ((t !== 'object') && (t !== 'array')) };
    data.utils.getSample = common.getSample;
    data.utils.schemaToArray = common.schemaToArray;
    data.utils.fakeProdCons = fakeProdCons;
    data.utils.getParameters = getParameters;
    data.utils.getCodeSamples = common.getCodeSamples;
    data.utils.getBodyParameterExamples = getBodyParameterExamples;
    data.utils.fakeBodyParameter = fakeBodyParameter;
    data.utils.mergePathParameters = mergePathParameters;
    data.utils.getResponses = getResponses;
    data.utils.getResponseExamples = getResponseExamples;
    data.utils.getResponseHeaders = getResponseHeaders;
    data.utils.getAuthenticationStr = getAuthenticationStr;
    data.utils.join = function(s) {
        return s.split('\r').join('').split('\n').join(' ').trim();
    };

    let content = '---\n'+yaml.dump(header)+'\n---\n\n'+
        templates.main(data);
    content = content.replace(/^\s*[\r\n]/gm,'\n\n'); // remove dupe blank lines

    callback(null,content);
}

function convert(api, options, callback) {
    if (options.resolve) {
        swagger2openapi.convertObj(api, {resolve:true}, function(err, sOptions) {
        if (err) {
            console.error(err.message);
        }
        else {
            convertInner(sOptions.openapi, options, callback);
        }});
    }
    else {
        convertInner(api, options, callback);
    }
}

module.exports = {
    convert : convert
};
