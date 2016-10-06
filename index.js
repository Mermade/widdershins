var up = require('url');

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
                var sMethodUniqueName = (sMethod.operationId ? sMethod.operationId : m+'_'+p).split('/').join('_');
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

function doContentType(types,target){
    for (var type in types) {
        if (types[type] === target) return true;
    }
    return false;
}

function convert(swagger,loadedFrom) {

    var header = {};
    header.title = swagger.info.title+' '+swagger.info.version;

    // TODO build this list from dynamic language templates
    // we always show json / yaml / xml if used in consumes/produces
    header.language_tabs = ['shell','http','html','javascript','python','ruby'];

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

    if (swagger.info.contact) {
        var name = (swagger.info.contact.name||'Support');
        if (swagger.info.contact.email) {
            content += 'Email: <a href="mailto:'+swagger.info.contact.email+'">'+name+'</a>\n';
        }
        if (swagger.info.contact.url) {
            content += 'Web: <a href="'+swagger.info.contact.url+'">'+name+'</a>\n';
        }
    }
    if (swagger.info.license) {
        content += 'License: <a href="'+swagger.info.license.url+'">'+swagger.info.license.name+'</a>\n';
    }

    if (swagger.securityDefinitions) {
        content += '# Authentication\n';
        for (var s in swagger.securityDefinitions) {
            var secdef = swagger.securityDefinitions[s];
            var desc = secdef.description ? secdef.description : '';
            if (secdef.type == 'apiKey') {
                content += '* '+secdef.type+'\n';
                content += '- Parameter Name: **'+secdef.name+'**, in: '+secdef.in+'. '+desc+'\n';
            }
            else if (secdef.type == 'basic') {
                content += '- Basic authentication. '+desc+'\n';
            }
            else if (secdef.type == 'oauth2') {
                content += '- oAuth2 authentication. '+desc+'\n';
                content += '- Flow: '+secdef.flow+'\n';
                if (secdef.authorizationUrl) {
                    content += '- Authorization URL = ['+secdef.authorizationUrl+']('+secdef.authorizationUrl+')\n';
                }
                for (var s in secdef.scopes) {
                    content += '- Scope: '+s+' = '+secdef.scopes[s]+'\n';
                }
            }
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

                var host = swagger.host;
                if (!host && loadedFrom) {
                    var u = up.parse(loadedFrom);
                    host = u.host;
                }
                if (!host) host = 'example.com';

                var url = (swagger.schemes ? swagger.schemes[0] : 'http')+'://'+(swagger.host||'example.com')+swagger.basePath+method.path;
                var consumes = (op.consumes||[]).concat(swagger.consumes||[]);
                var produces = (op.produces||[]).concat(swagger.produces||[]);

                content += '> Code samples\n\n';

                // TODO load code templates dynamically
                // TODO read from redoc extension if present

                content += '````shell\n';
                content += '# you can also use wget\n';
                content += 'curl -X '+method.op+' '+url+'\n';
                content += '````\n';

                content += '````http\n';
                content += method.op.toUpperCase()+' '+url+' HTTP/1.1\n';
                content += 'Host: '+swagger.host+'\n';
                if (consumes.length) {
                    content += 'Content-Type: '+consumes[0]+'\n';
                }
                if (produces.length) {
                    content += 'Accept: '+produces[0]+'\n';
                }
                content += '````\n';

                content += '````html\n';
                content += '<script>\n';
                content += '  $.ajax("'+url+'");\n';
                content += '</script>\n';
                content += '````\n';

                content += '````javascript\n';
                content += "const request = require('request');\n";
                content += "request('"+url+"');\n";
                content += '````\n';

                if (op.operationId) content += '**'+op.operationId+'**\n\n';
                if (op.summary) content += '*'+op.summary+'*\n\n';
                if (op.description) content += op.description+'\n\n';
                var parameters = (swagger.paths[method.path].parameters || []).concat(swagger.paths[method.path][method.op].parameters || []);
                if (parameters.length>0) {
                    var longDescs = false;
                    content += '### Parameters\n\n';
                    content += 'Parameter|In|Type|Required|Description\n';
                    content += '---|---|---|---|---|\n';
                    for (var p in parameters) {
                        var param = parameters[p];

                        if (param["$ref"]) {
                            param = jptr.jptr(swagger,param["$ref"]);
                        }

                        var desc = param.description ? param.description.split('\n')[0] : 'No description';
                        if (param.description && (param.description.split('\n').length>1)) longDescs = true;
                        content += param.name+'|'+param.in+'|'+(param.type||'object')+'|'+(param.required ? param.required : false)+'|'+desc+'\n';
                    }
                    content += '\n';

                    if (longDescs) {
                        for (var p in parameters) {
                            var param = parameters[p];
                            if (param["$ref"]) {
                                param = jptr.jptr(swagger,param["$ref"]);
                            }
                            var desc = param.description ? param.description : '';
                            var descs = desc.split('\n');
                            if (descs.length > 1) {
                                content += '##### '+param.name+'\n';
                                content += desc + '\n';
                            }
                        }
                    }

                    var paramHeader = false;
                    for (var p in parameters) {
                        var param = parameters[p];
                        if (param["$ref"]) {
                            param = jptr.jptr(swagger,param["$ref"]);
                        }
                        if (param.schema) {
                            if (!paramHeader) {
                                content += '> Body parameter\n\n';
                                paramHeader = true;
                            }
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
                            if (doContentType(consumes,'application/json')) {
                                content += '````json\n';
                                content += JSON.stringify(obj,null,2)+'\n';
                                content += '````\n';
                            }
                            if (doContentType(consumes,'text/x-yaml')) {
                                content += '````yaml\n';
                                content += yaml.safeDump(obj)+'\n';
                                content += '````\n';
                            }
                            if (doContentType(consumes,'application/xml')) {
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

                }

                content += '### Responses\n\n';
                content += 'Status|Meaning|Description\n';
                content += '---|--|---|\n';
                for (var resp in op.responses) {
                    var response = op.responses[resp];

                    var meaning = 'Unknown';
                    var url = '#';
                    for (var s in statusCodes) {
                        if (statusCodes[s].code == resp) {
                            meaning = statusCodes[s].phrase;
                            url = statusCodes[s].spec_href;
                            break;
                        }
                    }

                    content += resp+'|['+meaning+']('+url+')|'+response.description+'\n';
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
                        if (doContentType(consumes,'application/json')) {
                            content += '````json\n';
                            content += JSON.stringify(obj,null,2)+'\n';
                            content += '````\n';
                        }
                    }
                }

                content += '\n';

            }
        }
    }
    return (headerStr+'\n'+content);
}

module.exports = {
  convert : convert
};