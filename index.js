var up = require('url');
var path = require('path');

var yaml = require('js-yaml');
var xml = require('jgexml/json2xml.js');
var jptr = require('jgexml/jpath.js');
var recurseotron = require('openapi_optimise/common.js');
var circular = require('openapi_optimise/circular.js');
var sampler = require('openapi-sampler');
var dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = 'data';
var templates;

var circles = [];

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
    if (obj["$ref"]) {
		obj = jptr.jptr(swagger,obj["$ref"]);
	}
    var changes = 1;
    while (changes>0) {
        changes = 0;
        recurseotron.recurse(obj,{},function(obj,state) {
            if ((state.key === '$ref') && (typeof obj === 'string') && (!circular.isCircular(circles, obj))) {
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

    if (typeof templates === 'undefined') {
		templates = dot.process({ path: path.join(__dirname,'templates') });
	}
	if (options.user_templates) {
		templates = Object.assign(templates, dot.process({ path: options.user_templates }));
	}

    var header = {};
    header.title = swagger.info.title+' '+((swagger.info.version.toLowerCase().startsWith('v')) ? swagger.info.version : 'v'+swagger.info.version);

    // we always show json / yaml / xml if used in consumes/produces
    header.language_tabs = options.language_tabs;

	circles = circular.getCircularRefs(swagger, options);

    header.toc_footers = [];
    if (swagger.externalDocs) {
        if (swagger.externalDocs.url) {
            header.toc_footers.push('<a href="'+swagger.externalDocs.url+'">'+(swagger.externalDocs.description ? swagger.externalDocs.description : 'External Docs')+'</a>');
        }
    }
    header.includes = [];
    header.search = true;
    header.highlight_theme = options.theme||'darkula';

    var data = {};
	data.openapi = swagger;
	data.header = header;

    data.host = swagger.host;
    data.protocol = swagger.schemes ? swagger.schemes[0] : '';
    if (!data.host && options.loadedFrom) {
        var u = up.parse(options.loadedFrom);
        data.host = u.host;
        data.protocol = u.protocol.replace(':','');
    }
    if (!data.host) host = 'example.com';
	if (!data.protocol) protocol = 'http';

	data.baseUrl = data.protocol+'://'+data.host+(swagger.basePath ? swagger.basePath : '/');
    data.contactName = (swagger.info.contact && swagger.info.contact.name ? swagger.info.contact.name : 'Support');
    
    var content = '';
	content += templates.heading_main(data)+'\n';

    if (swagger.securityDefinitions) {
		data.securityDefinitions = [];
        for (var s in swagger.securityDefinitions) {
            var secdef = swagger.securityDefinitions[s];
            var desc = secdef.description ? secdef.description : '';
            if (secdef.type == 'oauth2') {
			    secdef.scopeArray = [];
                for (var s in secdef.scopes) {
					var scope = {};
					scope.name = s;
					scope.description = secdef.scopes[s];
					secdef.scopeArray.push(scope);
                }
            }
			secdef.ref = s;
			if (!secdef.description) secdef.description = '';
			data.securityDefinitions.push(secdef);
        }
		content += templates.security(data);
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

                var url = (swagger.schemes ? swagger.schemes[0] : data.protocol)+'://'+data.host+(swagger.basePath ? swagger.basePath : '')+method.path;
                var consumes = (op.consumes||[]).concat(swagger.consumes||[]);
                var produces = (op.produces||[]).concat(swagger.produces||[]);
				if ((consumes.length === 0) && (produces.length > 0)) {
					consumes = produces; // work around deficiency in at least petstore example
				}
                var parameters = (swagger.paths[method.path].parameters || []).concat(swagger.paths[method.path][method.op].parameters || []);
                // TODO dedupe overridden parameters

                var codeSamples = (options.codeSamples || op["x-code-samples"]);
                if (codeSamples) {
					data.method = method.op;
					data.methodUpper = method.op.toUpperCase();
					data.url = url;
					data.parameters = parameters;
					data.produces = produces;
					data.consumes = consumes;
					data.operation = method;
					data.resource = resource;

                    content += templates.heading_code_samples(data);

                    if (op["x-code-samples"]) {
                        for (var s in op["x-code-samples"]) {
                            var sample = op["x-code-samples"][s];
                            var lang = languageCheck(sample.lang,header.language_tabs,true);
                            content += '````'+lang+'\n';
                            content += sample.source;
                            content += '\n````\n';
                        }
                    }
                    else {
                        if (languageCheck('shell', header.language_tabs, false)) {
                            content += '````shell\n';
							content += templates.code_shell(data);
                            content += '````\n\n';
                        }
                        if (languageCheck('http', header.language_tabs, false)) {
                            content += '````http\n';
							content += templates.code_http(data);
                            content += '````\n\n';
                        }
                        if (languageCheck('html', header.language_tabs, false)) {
                            content += '````html\n';
							content += templates.code_html(data);
                            content += '````\n\n';
                        }
                        if (languageCheck('javascript', header.language_tabs, false)) {
                            content += '````javascript\n';
							content += templates.code_javascript(data);
                            content += '````\n\n';
                        }
                        if (languageCheck('ruby', header.language_tabs, false)) {
                            content += '````ruby\n';
							content += templates.code_ruby(data);
                            content += '````\n\n';
                        }
                        if (languageCheck('python', header.language_tabs, false)) {
                            content += '````python\n';
							content += templates.code_python(data);
                            content += '````\n\n';
                        }
                        if (languageCheck('java', header.language_tabs, false)) {
                            content += '````java\n';
							content += templates.code_java(data);
                            content += '````\n\n';
                        }
                    }
                }

                if (subtitle != opName) content += '`'+subtitle+'`\n\n';
                if (op.summary) content += '*'+op.summary+'*\n\n';
                if (op.description) content += op.description+'\n\n';

				data.enums = [];
 
				if (parameters.length>0) {
                    var longDescs = false;
                    for (var p in parameters) {
                        var param = parameters[p];

                        if (param["$ref"]) {
                            parameters[p] = param = jptr.jptr(swagger,param["$ref"]);
                        }
						param.shortDesc = param.description ? param.description.split('\n')[0] : 'No description';
                        if (param.description && (param.description.split('\n').length>1)) longDescs = true;
						param.type = (param.type || 'object');
						if (param.type == 'object') {
							if (param.schema && param.schema.type) {
								param.type = param.schema.type;
							}
							if (param.schema && param.schema["$ref"]) {
								param.type = param.schema["$ref"].split('/').pop();
							}
						}
						if ((param.type == 'array') && param.items && param.items.type) {
							param.type += '['+param.items.type+']';
						}
						if ((param.type == 'array') && param.schema && param.schema.items && param.schema.items["$ref"]) {
							param.type += '['+param.schema.items["$ref"].split('/').pop()+']';
						}
						param.required = (param.required ? param.required : false);

						if (param.enum) {
							for (var e in param.enum) {
								var nvp = {};
								nvp.name = param.name;
								nvp.value = param.enum[e];
								data.enums.push(nvp);
							}
						}
						if (param.items && param.items.enum) {
							for (var e in param.items.enum) {
								var nvp = {};
								nvp.name = param.name;
								nvp.value = param.items.enum[e];
								data.enums.push(nvp);
							}
						}

                    }
					data.parameters = parameters;
					content += templates.parameters(data);

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
                    			content += templates.heading_body_parameter(data);
                                paramHeader = true;
                            }
                            var xmlWrap = '';
                            var obj = dereference(param.schema,swagger);
                            if (obj.xml && obj.xml.name) {
                                xmlWrap = obj.xml.name;
                            }
                            var oobj = clone(obj);
                            try {
                           		obj = sampler.sample(obj, {skipReadOnly: true});
                                if (obj == null) {
                                    obj = oobj;
                                }
                          	}
                          	catch (ex) {
                           	   	console.log('# '+ex);
                           	}
                            if (obj && obj.properties) obj = obj.properties;
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

                var responseSchemas = false;
                var responseHeaders = false;
				data.responses = [];
                for (var resp in op.responses) {
                    var response = op.responses[resp];
                    if (response.schema) responseSchemas = true;
                    if (response.headers) responseHeaders = true;

					response.status = resp;
                    response.meaning = (resp == 'default' ? 'Default' :'Unknown');
                    var url = '';
                    for (var s in statusCodes) {
                        if (statusCodes[s].code == resp) {
                            response.meaning = statusCodes[s].phrase;
                            url = statusCodes[s].spec_href;
                            break;
                        }
                    }
                    if (url) response.meaning = '['+response.meaning+']('+url+')';
					if (!response.description) response.description = 'No description';
					data.responses.push(response);
                }
				content += templates.responses(data);

                if (responseHeaders) {
					data.response_headers = [];
                    for (var resp in op.responses) {
                        var response = op.responses[resp];
                        for (var h in response.headers) {
						    var hdr = response.headers[h];
							hdr.status = resp;
							hdr.header = h;
							if (!hdr.format) hdr.format = '';
							if (!hdr.description) hdr.description = '';

							data.response_headers.push(hdr);
                        }
                    }
					content += templates.response_headers(data);
                }

                if (responseSchemas) {
					content += templates.heading_example_responses(data);
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
				    content += templates.authentication_none(data);
                }
                else {
				    data.securityDefinitions = [];
                    var list = '';
                    for (var s in security) {
                        var link = '#/securityDefinitions/'+Object.keys(security[s])[0];
                        var secDef = jptr.jptr(swagger,link);
						data.securityDefinitions.push(secDef);
                        list += (list ? ', ' : '')+secDef.type;
                        var scopes = security[s][Object.keys(security[s])[0]];
                        if (Array.isArray(scopes) && (scopes.length>0)) {
                            list += ' ( Scopes: ';
                            for (var scope in scopes) {
                                list += scopes[scope] + ' ';
                            }
                            list += ')';
                        }
                    }
					data.authenticationStr = list;
					content += templates.authentication(data);
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
