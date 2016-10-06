var yaml = require('js-yaml');
var xml = require('jgexml/json2xml.js');
var jptr = require('jgexml/jpath.js');
var recurseotron = require('openapi_optimise/common.js');
var sampler = require('openapi-sampler');

/* originally from https://github.com/for-GET/know-your-http-well/blob/master/json/status-codes.json */
/* "Unlicensed", public domain */
var statusCodes = require('./statusCodes.json');

function clone(obj){
    return JSON.parse(JSON.stringify(obj));
}

/**
* function to reformat swagger paths object into an iodocs-style resources object, tags-first
*/
function convertSwagger(source){
    var apiInfo = clone(source,false);
    apiInfo.resources = {};
    for (var p in apiInfo.paths) {
        for (var m in apiInfo.paths[p]) {
            if (m != 'parameters') {
                var sMethod = apiInfo.paths[p][m];
                var ioMethod = {};
                ioMethod.path = p;
                ioMethod.op = m;
                var sMethodUniqueName = sMethod.operationId ? sMethod.operationId : m+'_'+p.split('/').join('_');
                sMethodUniqueName = sMethodUniqueName.split(' ').join('_'); // TODO {, } and : ?
                var tagName = 'Default';
                if (sMethod.tags && sMethod.tags.length>0) {
                    tagName = sMethod.tags[0];
                }
                if (!apiInfo.resources[tagName]) {
                    apiInfo.resources[tagName] = {};
                    if (apiInfo.tags) {
                        for (var t in apiInfo.tags) {
                            var tag = apiInfo.tags[t];
                            if (tag.name == tagName) {
                                apiInfo.resources[tagName].description = tag.description;
                                apiInfo.resources[tagName].externalDocs = tag.externalDocs;
                            }
                        }
                    }
                }
                if (!apiInfo.resources[tagName].methods) apiInfo.resources[tagName].methods = {};
                apiInfo.resources[tagName].methods[sMethodUniqueName] = ioMethod;
            }
        }
    }
    delete apiInfo.paths; // to keep size down
    delete apiInfo.definitions; // ditto
    return apiInfo;
}

function dereference(obj,swagger){
    if (obj["$ref"]) obj = clone(jptr.jptr(swagger,obj["$ref"]));
    var changes = 1;
    while (changes>0) {
        changes = 0;
        recurseotron.recurse(obj,{},function(obj,state) {
            if ((state.key === '$ref') && (typeof obj === 'string')) {
                //console.log('#Dereferencing '+obj);
                state.parents[state.parents.length-1][state.keys[state.keys.length-1]] = jptr.jptr(swagger,obj);
                delete state.parent["$ref"];
                changes++;
            }
        });
    }
    //console.log(JSON.stringify(obj,null,'# '));
    return obj;
}

var swagger = require('./specs/petstore.json');

var header = {};
header.title = swagger.info.title+' '+swagger.info.version;

// TODO build this list from consumes/produces + dynamic language templates
// we always show json
header.language_tabs = ['shell','http','xml','yaml','html','javascript','python','ruby'];

header.toc_footers = [];
if (swagger.externalDocs) {
    header.toc_footers.push(swagger.externalDocs.description);
    if (swagger.externalDocs.url) {
        header.toc_footers.push('<a href="'+swagger.externalDocs.url+'">External Docs</a>');
    }
}
header.includes = [];
header.search = true;

var headerStr = '---\n'+yaml.safeDump(header)+'---\n';

var content = '';

content += '# Introduction\n';
content += swagger.info.description+'\n\n';
if (swagger.info.termsOfService) {
    content += '<a href="'+swagger.info.termsOfService+'">Terms of service</a>\n';
}

if (swagger.securityDefinitions) {
    content += '# Authentication\n';
    for (var s in swagger.securityDefinitions) {
        content += '* '+swagger.securityDefinitions[s].type+'\n';
    }
}

var apiInfo = convertSwagger(swagger);

for (var r in apiInfo.resources) {
    content += '# '+r+'\n\n';
    var resource = apiInfo.resources[r]
    if (resource.description) content += resource.description+'\n\n';

    if (resource.externalDocs) {
        content += swagger.externalDocs.description+'\n';
        if (swagger.externalDocs.url) {
            content += '<a href="'+swagger.externalDocs.url+'">External Docs</a>\n';
        }
    }

    for (var m in resource.methods) {
        var method = resource.methods[m];
        content += '## '+method.op.toUpperCase()+' '+method.path+'\n\n';
        var op = swagger.paths[method.path][method.op];
        if (method.op != 'parameters') {

            var url = (swagger.schemes[0]||'http')+'://'+(swagger.host||'example.com')+swagger.basePath+method.path;

            content += '> Code samples\n\n';

            // TODO load code templates dynamically
            // TODO read from redoc extension if present

            content += '````shell\n';
            content += '# you can also use wget\n';
            content += 'curl -X '+method.op+' '+url+'\n';
            content += '````\n';

            content += '````http\n';
            content += 'HTTP 1.1 '+method.op.toUpperCase()+' '+url+'\n';
            content += '````\n';

            content += '````html\n';
            content += '<script>\n';
            content += '  $.ajax("'+url+'");\n';
            content += '</script>\n';
            content += '````\n';

            content += '````javascript\n';
            content += "const request = require('request')\n";
            content += "request('"+url+"');\n";
            content += '````\n';

            if (op.operationId) content += '**'+op.operationId+'**\n\n';
            if (op.summary) content += '*'+op.summary+'*\n\n';
            if (op.description) content += op.description+'\n\n';
            var parameters = (swagger.paths[method.path].parameters || []).concat(swagger.paths[method.path][method.op].parameters || []);
            if (parameters.length>0) {
                content += '### Parameters\n\n';
                content += 'Parameter|In|Type|Required|Description\n';
                content += '---|---|---|---|---|\n';
                for (var p in parameters) {
                    var param = parameters[p];

                    if (param["$ref"]) {
                        param = jptr.jptr(swagger,param["$ref"]);
                    }

                    content += param.name+'|'+param.in+'|'+(param.type||'object')+'|'+(param.required ? param.required : false)+'|'+param.description+'\n';
                }
                content += '\n';

                for (var p in parameters) {
                    var param = parameters[p];
                    if (param["$ref"]) {
                        param = jptr.jptr(swagger,param["$ref"]);
                    }
                    if (param.schema) {
                        var xmlWrap = '';
                        var obj = dereference(param.schema,swagger);
                        if (obj.xml && obj.xml.name) {
                            xmlWrap = obj.xml.name;
                        }
                        try {
                            obj = sampler.sample(obj);
                        }
                        catch (ex) {
                            console.log('# '+ex);
                        }
                        if (obj.properties) obj = obj.properties;
                        content += '````json\n';
                        content += JSON.stringify(obj,null,2)+'\n';
                        content += '````\n';
                        content += '````yaml\n';
                        content += yaml.safeDump(obj)+'\n';
                        content += '````\n';
                        content += '````xml\n';
                        if (xmlWrap) {
                            var newObj = {};
                            newObj[xmlWrap] = obj;
                            obj = newObj;
                        }
                        content += xml.getXml(obj,'@','',true,'  ',false)+'\n';
                        content += '````\n';
                    }
                }

            }

            content += '### Responses\n\n';
            content += 'Status|Meaning|Description\n';
            content += '---|--|---|\n';
            for (var resp in op.responses) {
                var response = op.responses[resp];

                var meaning = 'Unknown';
                for (var s in statusCodes) {
                    if (statusCodes[s].code == resp) {
                        meaning = statusCodes[s].phrase;
                        break;
                    }
                }

                content += resp+'|'+meaning+'|'+response.description+'\n';
            }
            content += '> Example responses\n\n';
            for (var resp in op.responses) {
                var response = op.responses[resp];
                if (response.schema) {
                    var obj = dereference(response.schema);
                    try {
                        obj = sampler.sample(obj);
                    }
                    catch (ex) {
                        console.log('# '+ex);
                    }
                    content += '````json\n';
                    content += JSON.stringify(obj,null,2)+'\n';
                    content += '````\n';
                }
            }

            content += '\n';

        }
    }
}

console.log(headerStr);
console.log(content);