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
                state.parents[state.parents.length-2][state.keys[state.keys.length-2]] = jptr.jptr(swagger,obj);
                delete state.parent["$ref"];
                changes++;
            }
        });
    }
    return obj;
}

function doContentType(types,target){
    for (var type in types) {
        if (types[type] === target) return true;
    }
    return false;
}

function languageCheck(language,language_tabs,mutate){
    var lcLang = language.toLowerCase();
    if (lcLang === 'c#') lcLang = 'csharp';
    if (lcLang === 'c++') lcLang = 'cpp';
    for (var l in language_tabs){
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

function convert(swagger,options) {

    var defaults = {};
    defaults.language_tabs = [{'shell': 'Shell'},{'http': 'HTTP'},{'html': 'JavaScript'},{'javascript': 'Node.JS'},{'python': 'Python'},{'ruby': 'Ruby'},{'java': 'Java'}];
    defaults.codeSamples = true;
    options = Object.assign({},defaults,options);

    var header = {};
    header.title = swagger.info.title+' '+((swagger.info.version.toLowerCase().startsWith('v')) ? swagger.info.version : 'v'+swagger.info.version);

    // we always show json / yaml / xml if used in consumes/produces
    header.language_tabs = options.language_tabs;

    header.toc_footers = [];
    if (swagger.externalDocs) {
        if (swagger.externalDocs.url) {
            header.toc_footers.push('<a href="'+swagger.externalDocs.url+'">'+swagger.externalDocs.description+'</a>');
        }
    }
    header.includes = [];
    header.search = true;
    header.highlight_theme = options.theme||'darkula';

    var content = '';

    content += '# ' + header.title+'\n\n';
    if (swagger.info.description) content += swagger.info.description+'\n\n';
    var host = swagger.host;
    var protocol = swagger.schemes ? swagger.schemes[0] : '';
    if (!host && options.loadedFrom) {
        var u = up.parse(options.loadedFrom);
        host = u.host;
        protocol = u.protocol.replace(':','');
    }
    if (!host) host = 'example.com';
    if (!protocol) protocol = 'http';
    content += 'Base URL = '+protocol+'://'+host+swagger.basePath+'\n\n';
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
                if (secdef.tokenUrl) {
                    content += '- Token URL = ['+secdef.tokenUrl+']('+secdef.tokenUrl+')\n';
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
            if (resource.externalDocs.url) {
                content += '<a href="'+resource.externalDocs.url+'">'+resource.externalDocs.description+'</a>\n';
            }
        }

        for (var m in resource.methods) {
            var method = resource.methods[m];
            var subtitle = method.op.toUpperCase()+' '+method.path;
            var op = swagger.paths[method.path][method.op];
            if (method.op != 'parameters') {

                var opName = (op.operationId ? op.operationId : subtitle);
                content += '## '+opName+'\n\n';

                var url = (swagger.schemes ? swagger.schemes[0] : 'http')+'://'+host+swagger.basePath+method.path;
                var consumes = (op.consumes||[]).concat(swagger.consumes||[]);
                var produces = (op.produces||[]).concat(swagger.produces||[]);

                var codeSamples = (options.codeSamples || op["x-code-samples"]);
                if (codeSamples) {

                    content += '> Code samples\n\n';

                    if (op["x-code-samples"]) {
                        for (var s in op["x-code-samples"]) {
                            var sample = op["x-code-samples"][s];
                            var lang = languageCheck(sample.lang,header.language_tabs,true);
                            content += '````'+lang+'\n';
                            content += sample.source+'\n';
                            content += '````\n';
                        }
                    }
                    else {
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
                        content += '  $.ajax({\n';
                        content += "    url: '"+url+"',\n";
                        content += "    method: '"+method.op+"',\n";
                        content += '    success: function(data) {\n';
                        content += '      console.log(JSON.stringify(data));\n';
                        content += '    }\n';
                        content += '  })\n';
                        content += '</script>\n';
                        content += '````\n';

                        content += '````javascript\n';
                        content += "const request = require('node-fetch');\n";
                        content += "fetch('"+url+"', { method: '"+method.op.toUpperCase()+"'})\n";
                        content += ".then(function(res) {\n";
                        content += "    return res.json();\n";
                        content += "}).then(function(body) {\n";
                        content += "    console.log(body);\n";
                        content += "});\n";
                        content += '````\n';

                        content += '````ruby\n';
                        content += "require 'rest-client'\n";
                        content += "require 'json'\n";
                        content += '\n';
                        content += 'result = RestClient.'+method.op+" '"+url+"', params:\n";
                        content += '  {\n';
                        content += '    # TODO\n';
                        content += '  }\n';
                        content += '\n';
                        content += 'p JSON.parse(result)\n';
                        content += '````\n';

                        content += '````python\n';
                        content += "import requests\n";
                        content += '\n';
                        content += 'r = requests.'+method.op+"('"+url+"', params={\n";
                        content += '  # TODO\n';
                        content += '})\n';
                        content += '\n';
                        content += 'print r.json()\n';
                        content += '````\n';
                        
                        content += '````java\n';
                        content += 'public static void main(String[] args) {';
                        content += '	URL obj = new URL("'+url+'");';
                        content += '	HttpURLConnection con = (HttpURLConnection) obj.openConnection();';
                        content += '	con.setRequestMethod('+method.op+');';
                        content += '	int responseCode = con.getResponseCode();';
                        content += '	BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()));';
                        content += '	String inputLine;';
                        content += '	StringBuffer response = new StringBuffer();';
                        content += '	while ((inputLine = in.readLine()) != null) {';
                        content += '		response.append(inputLine);';
                        content += '	}';
                        content += '	in.close();';
                        content += '	System.out.println(response.toString());';
                        content += '}';
                        content += '````\n';
                    }
                }

                //if (op.operationId) content += '**'+op.operationId+'**\n\n';
                if (subtitle != opName) content += '`'+subtitle+'`\n\n';
                if (op.summary) content += '*'+op.summary+'*\n\n';
                if (op.description) content += op.description+'\n\n';
                var parameters = (swagger.paths[method.path].parameters || []).concat(swagger.paths[method.path][method.op].parameters || []);
                // TODO dedupe overridden parameters
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
                content += '---|---|---|\n';
                var responseSchemas = false;
                var responseHeaders = false;
                for (var resp in op.responses) {
                    var response = op.responses[resp];
                    if (response.schema) responseSchemas = true;
                    if (response.headers) responseHeaders = true;

                    var meaning = (resp == 'default' ? 'Default' :'Unknown');
                    var url = '';
                    for (var s in statusCodes) {
                        if (statusCodes[s].code == resp) {
                            meaning = statusCodes[s].phrase;
                            url = statusCodes[s].spec_href;
                            break;
                        }
                    }
                    if (url) meaning = '['+meaning+']('+url+')';

                    content += resp+'|'+meaning+'|'+response.description+'\n';
                }

                if (responseHeaders) {
                    content += '### Response Headers\n\n';
                    content += 'Status|Header|Type|Format|Description\n';
                    content += '---|---|---|---|---|\n';
                    for (var resp in op.responses) {
                        var response = op.responses[resp];
                        for (var h in response.headers) {
                            content += resp+'|'+h+'|'+response.headers[h].type+'|'+response.headers[h].format+'|'+response.headers[h].description+'\n';
                        }
                    }
                }

                if (responseSchemas) {
                    content += '> Example responses\n\n';
                    for (var resp in op.responses) {
                        var response = op.responses[resp];
                        if (response.schema) {
                            var xmlWrap = '';
                            var obj = dereference(response.schema,swagger);
                            if (obj.xml && obj.xml.name) {
                                xmlWrap = obj.xml.name;
                            }
                            if (Object.keys(obj).length>0) {
                                try {
                                    obj = sampler.sample(obj);
                                }
                                catch (ex) {
                                    console.log('# '+ex);
                                }
                                if (doContentType(produces,'application/json')) {
                                    content += '````json\n';
                                    content += JSON.stringify(obj,null,2)+'\n';
                                    content += '````\n';
                                }
                                if (doContentType(produces,'text/x-yaml')) {
                                    content += '````json\n';
                                    content += yaml.safeDump(obj)+'\n';
                                    content += '````\n';
                                }
                                if (xmlWrap) {
                                    var newObj = {};
                                    newObj[xmlWrap] = obj;
                                    obj = newObj;
                                }
                                if ((typeof obj === 'object') && doContentType(produces,'application/xml')) {
                                    content += '````xml\n';
                                    content += xml.getXml(obj,'@','',true,'  ',false)+'\n';
                                    content += '````\n';
                                }
                            }
                        }
                    }
                }

                var security = (op.security ? op.security : swagger.security);
                if (!security) security = [];
                if (security.length<=0) {
                    content += '<aside class="success">\n';
                    content += 'This operation does not require authentication\n';
                    content += '</aside>\n';
                }
                else {
                    content += '<aside class="warning">\n';
                    content += 'To perform this operation, you must be authenticated by means of one of the following methods:\n';
                    var list = '';
                    for (var s in security) {
                        var link = '#/securityDefinitions/'+Object.keys(security[s])[0];
                        var secDef = jptr.jptr(swagger,link);
                        list += (list ? ', ' : '')+secDef.type;
                        var data = security[s][Object.keys(security[s])[0]];
                        if (Array.isArray(data) && (data.length>0)) {
                            list += ' ( Scopes: ';
                            for (var scope in data) {
                                list += data[scope] + ' ';
                            }
                            list += ')';
                        }
                    }
                    content += list+'\n';
                    content += '</aside>\n';
                }

                content += '\n';

            }
        }
    }
    var headerStr = '---\n'+yaml.safeDump(header)+'---\n';
    return (headerStr+'\n'+content);
}

module.exports = {
  convert : convert
};
