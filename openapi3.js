'use strict';

var up = require('url');
var path = require('path');
var util = require('util');

var yaml = require('js-yaml');
var xml = require('jgexml/json2xml.js');
var jptr = require('jgexml/jpath.js');
var circular = require('openapi_optimise/circular.js');
var sampler = require('openapi-sampler');
var dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = 'data';
var templates;

var common = require('./common.js');

var data;
var content;
var circles = [];

/**
* function to reformat openapi paths object into an iodocs-style resources object, tags-first
*/
function convertToToc(source) {
	var apiInfo = common.clone(source, false);
	apiInfo.resources = {};
	for (var p in apiInfo.paths) {
		for (var m in apiInfo.paths[p]) {
			if (m != 'parameters') {
				var sMethod = apiInfo.paths[p][m];
				var ioMethod = {};
				ioMethod.path = p;
				ioMethod.op = m;
				var sMethodUniqueName = (sMethod.operationId ? sMethod.operationId : m + '_' + p).split('/').join('_');
				sMethodUniqueName = sMethodUniqueName.split(' ').join('_'); // TODO {, } and : ?
				var tagName = 'Default';
				if (sMethod.tags && sMethod.tags.length > 0) {
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
	delete apiInfo.components; // ditto
	return apiInfo;
}

function processOperation(op, method, resource, options) {
	var header = data.header;
	var opName = (op.operationId ? op.operationId : data.subtitle);
	content += '## ' + opName + '\n\n'; // TODO template?

	var url = data.servers[0].url + method.path;
	var produces = [];
	var consumes = [];

	var rbType = 'object';
	if (op.requestBody) {
		if (op.requestBody.$ref) {
			rbType = op.requestBody.$ref.replace('#/components/requestBodies/', '');
			rbType = '['+rbType+'](#'+common.gfmLink('schema+'+rbType)+')';
			op.requestBody = jptr.jptr(data.openapi, op.requestBody.$ref);
		}
		for (var rb in op.requestBody.content) {
			consumes.push(rb);
		}
	}
	for (var r in op.responses) {
		var response = op.responses[r];
		if (response.$ref) {
			response = jptr.jptr(data.openapi, response.$ref);
		}
		for (var prod in response.content) {
			produces.push(prod);
		}
	}

	data.method = method.op;
	data.methodUpper = method.op.toUpperCase();
	data.produces = produces;
	data.consumes = consumes;
	data.url = url;
	data.operation = method;
	data.operationId = op.operationId;
	data.tags = op.tags;
	data.security = op.security;
	data.resource = resource; // TODO for callbacks?
	data.queryString = '';
	data.requiredQueryString = '';
	data.queryParameters = [];
	data.requiredParameters = [];
	data.headerParameters = [];
	data.bodyParameter = null;

	var sharedParameters = data.openapi.paths[method.path].parameters || [];
	var opParameters = (data.openapi.paths[method.path][method.op].parameters || []);

	// dereference shared/op parameters while separate before removing overridden shared parameters
	for (var p in sharedParameters) {
		if (sharedParameters[p]["$ref"]) {
			sharedParameters[p] = jptr.jptr(data.openapi, sharedParameters[p]["$ref"]);
		}
	}
	for (var p in opParameters) {
		if (opParameters[p]["$ref"]) {
			opParameters[p] = jptr.jptr(data.openapi, opParameters[p]["$ref"]);
		}
	}

	// remove overridden shared (path) parameters
	if ((sharedParameters.length > 0) && (opParameters.length > 0)) {
		sharedParameters = [].concat(sharedParameters); // clone
		for (var sp of sharedParameters) {
			var match = opParameters.find(function (elem) {
				return ((elem.name == sp.name) && (elem.in == sp.in));
			});
			if (match) {
				sp["x-widdershins-delete"] = true;
			}
		}
		sharedParameters = sharedParameters.filter(function (e, i, a) {
			return !e["x-widdershins-delete"];
		});
	}

	// combine
	var parameters = sharedParameters.concat(opParameters);

	if (op.requestBody) {
		// fake a version 2-style body parameter
		var body = {};
		body.name = 'body';
		body.in = 'body';
		body.required = op.requestBody.required;
		body.description = op.requestBody.description ? op.requestBody.description : 'No description';
		body.schema = op.requestBody.content[Object.keys(op.requestBody.content)[0]].schema;
		if (body.schema && typeof body.schema.$ref === 'string') {
			rbType = body.schema.$ref.replace('#/components/schemas/','');
			rbType = '['+rbType+'](#'+common.gfmLink('schema'+rbType)+')';
			body.schema = common.dereference(body.schema, circles, data.openapi, common.clone);
		}
		body.type = rbType;
		parameters.push(body);
		if (options.schema && body.schema && body.schema.type && body.schema.type === 'object') {
			common.schemaToArray(body.schema,1,parameters,false);
		}
	}

	for (var p in parameters) {
		var param = parameters[p];
		param.required = (param.required ? param.required : false);
		param.safeType = (param.type || 'object');
		if (!param.depth) param.depth = 0;
		if (param.safeType == 'object') {
			if (param.schema && param.schema.type) {
				param.safeType = param.schema.type;
			}
			if (param.schema && param.schema["$ref"]) {
				param.safeType = param.schema["$ref"].split('/').pop();
				param.safeType = '['+param.safeType+'](#'+common.gfmLink('schema'+param.safeType)+')';
			}
		}
		if ((param.safeType == 'array') && param.schema && param.schema.items && param.schema.items.type) {
			param.safeType += '[' + param.schema.items.type + ']';
		}
		if ((param.safeType == 'array') && param.schema && param.schema.items && param.schema.items["$ref"]) {
			param.safeType += '[' + param.schema.items["$ref"].split('/').pop() + ']';
		}
		if (param.schema && param.schema.format) {
			param.safeType = param.safeType + '(' + param.schema.format + ')';
		}
		param.exampleSchema = param.schema || {};
		param.exampleValues = {};
		param.exampleValues.json = '{}';
		param.exampleValues.object = {};
		try {
			var obj = sampler.sample(param.exampleSchema, { skipReadOnly: true });
			var t = obj;
			if (typeof t == 'string') t = "'" + t + "'";
			if (typeof t == 'object') t = JSON.stringify(t, null, 2);
			param.exampleValues.json = t;
			param.exampleValues.object = obj;
		}
		catch (ex) {
			console.error(ex);
			param.exampleValues.json = '...';
		}
		if ((param.in == 'body') && (!data.bodyParameter)) { // ignore expanded lines
			data.bodyParameter = param;
		}
		if (param.in == 'header') {
			data.headerParameters.push(param);
		}
		if (param.in == 'query') {
			let temp = param.exampleValues.object;
			if (Array.isArray(temp)) {
				temp = '...';
			}
			if (!param.allowReserved) {
				temp = encodeURIComponent(temp);
			}
			data.queryParameters.push(param);
			data.queryString += (data.queryString ? '&' : '?') + param.name + '=' + temp;
			if (param.required) {
				data.requiredQueryString += (data.requiredQueryString ?
					'&' : '?') + param.name + '=' + temp;
				data.requiredParameters.push(param);
			}
		}
	}
	data.parameters = parameters;

	data.allHeaders = common.clone(data.headerParameters);
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

	var codeSamples = (options.codeSamples || op["x-code-samples"]);
	if (codeSamples) {
		data = options.templateCallback('heading_code_samples', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.heading_code_samples(data);
		data = options.templateCallback('heading_code_samples', 'post', data);
		if (data.append) { content += data.append; delete data.append; }

		if (op["x-code-samples"]) {
			for (var s in op["x-code-samples"]) {
				var sample = op["x-code-samples"][s];
				var lang = common.languageCheck(sample.lang, header.language_tabs, true);
				content += '```' + lang + '\n';
				content += sample.source;
				content += '\n```\n';
			}
		}
		else {
			for (var l in header.language_tabs) {

				var target = header.language_tabs[l];
				if (typeof target === 'object') {
					l = Object.keys(target)[0];
				}
				var lcLang = common.languageCheck(l, header.language_tabs, false);
				if (lcLang) {
					var templateName = 'code_'+lcLang.substring(lcLang.lastIndexOf('-') + 1);
                    var templateFunc = templates[templateName];
                    if (templateFunc) {
                        content += '```' + lcLang + '\n';
                        data = options.templateCallback(templateName, 'pre', data);
                        if (data.append) { content += data.append; delete data.append; }
                        content += templateFunc(data);
                        data = options.templateCallback(templateName, 'post', data);
                        if (data.append) { content += data.append; delete data.append; }
                        content += '```\n\n';
                    }
				}
			}
		}
	}

	// TODO template?
	if (data.subtitle != opName) content += '`' + data.subtitle + '`\n\n';
	if (op.summary) content += '*' + op.summary + '*\n\n';
	if (op.description) content += op.description + '\n\n';

	data.enums = [];

	if (parameters.length > 0) {
		var longDescs = false;
		for (var p in parameters) {
			param = parameters[p];
			param.shortDesc = (typeof param.description === 'string') ? param.description.split('\n')[0] : 'No description';
			if ((typeof param.description === 'string') && (param.description.trim().split('\n').length > 1)) longDescs = true;
			param.originalType = param.type;
			param.type = param.safeType;

			if (param.schema && param.schema.enum) {
				for (var e in param.schema.enum) {
					var nvp = {};
					nvp.name = param.name;
					nvp.value = param.schema.enum[e];
					data.enums.push(nvp);
				}
			}
			if (param.schema && param.schema.items && param.schema.items.enum) {
				for (var e in param.schema.items.enum) {
					var nvp = {};
					nvp.name = param.name;
					nvp.value = param.schema.items.enum[e];
					data.enums.push(nvp);
				}
			}

		}

		var paramHeader = false;
		for (var p in parameters) {
			param = parameters[p];
			if ((param.in === 'body') && (param.depth == 0)) {
				var xmlWrap = '';
				var obj = common.dereference(param.schema, circles, data.openapi, common.clone);
				if (obj && !paramHeader) {
					data = options.templateCallback('heading_body_parameter', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.heading_body_parameter(data);
					data = options.templateCallback('heading_body_parameter', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
					paramHeader = true;
				}
				if (obj && obj.xml && obj.xml.name) {
					xmlWrap = obj.xml.name;
				}
				if (obj && options.sample) {
					try {
						obj = sampler.sample(obj, { skipReadOnly: true });
					}
					catch (ex) {
						console.error(ex);
					}
				}
				if (obj && obj.properties) obj = obj.properties;
				if (obj) {
					if (common.doContentType(consumes, common.jsonContentTypes)) {
						content += '```json\n';
						content += JSON.stringify(obj, null, 2) + '\n';
						content += '```\n';
					}
					if (common.doContentType(consumes, common.yamlContentTypes)) {
						content += '```yaml\n';
						content += yaml.safeDump(obj) + '\n';
						content += '```\n';
					}
					if (common.doContentType(consumes, common.formContentTypes)) {
						content += '```yaml\n';
						content += yaml.safeDump(obj) + '\n';
						content += '```\n';
					}
					if (common.doContentType(consumes, common.xmlContentTypes) && (typeof obj === 'object')) {
						content += '```xml\n';
						if (xmlWrap) {
							var newObj = {};
							newObj[xmlWrap] = obj;
							obj = newObj;
						}
						content += xml.getXml(obj, '@', '', true, '  ', false) + '\n';
						content += '```\n';
					}
				}
			}
		}

		data.parameters = parameters; // redundant?
		data = options.templateCallback('parameters', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.parameters(data);
		data = options.templateCallback('parameters', 'post', data);
		if (data.append) { content += data.append; delete data.append; }

		if (longDescs) {
			for (var p in parameters) {
				var param = parameters[p];
				var desc = param.description ? param.description : '';
				var descs = [];
				if (typeof desc === 'string') {
					descs = desc.trim().split('\n');
				}
				if (descs.length > 1) {
					content += '##### ' + param.name + '\n'; // TODO template
					content += desc + '\n';
				}
			}
		}

	}

	var responseSchemas = false;
	var responseHeaders = false;
	var inlineSchemas = false;
	data.responses = [];
	for (var resp in op.responses) {
		let response = op.responses[resp];
		if (response.schema || response.content) responseSchemas = true;
		if (response.headers) responseHeaders = true;
	}

	for (var resp in op.responses) {
		let response = op.responses[resp];

		response.status = resp;
		response.meaning = (resp == 'default' ? 'Default' : 'Unknown');
		var url = '';
		for (var s in common.statusCodes) {
			if (common.statusCodes[s].code == resp) {
				response.meaning = common.statusCodes[s].phrase;
				url = common.statusCodes[s].spec_href;
				break;
			}
		}
		if (url) response.meaning = '[' + response.meaning + '](' + url + ')';
		if (!response.description) response.description = 'No description';
		response.description = response.description.trim();

		response.schema = 'None';
		if (response.content) {
			for (let c in response.content) {
				let mediatype = response.content[c];
				if (mediatype.schema) {
					response.schema = 'Inline';
					if (mediatype.schema.$ref) {
						let ref = mediatype.schema.$ref.split('/').pop();
						response.schema = '['+ref+'](#schema'+common.gfmLink(ref)+')';
					}
					else if ((Object.keys(mediatype.schema).length == 1) && (mediatype.schema.type)) {
						response.schema = mediatype.schema.type;
					}
					else if ((Object.keys(mediatype.schema).length == 2) && (mediatype.schema.type) && (mediatype.schema.format)) {
						response.schema = mediatype.schema.type+'('+mediatype.schema.format+')';
					}
					else {
						inlineSchemas = true;
					}
				}
			}
		}
		data.responses.push(response);
	}

	if (responseSchemas) {
		data = options.templateCallback('heading_example_responses', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.heading_example_responses(data);
		data = options.templateCallback('heading_example_responses', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
		for (var resp in op.responses) {
			var response = op.responses[resp];
			for (var ct in response.content) {
				var contentType = response.content[ct];
				var cta = [ct];
				if (contentType.schema) {
					var xmlWrap = '';
					var obj = {};
					try {
						obj = common.dereference(contentType.schema, circles, data.openapi, common.clone);
					}
					catch (ex) {
						console.error(ex.message);
					}
					if (obj && obj.xml && obj.xml.name) {
						xmlWrap = obj.xml.name;
					}
					if (Object.keys(obj).length > 0) {
						if (options.sample) {
							try {
								obj = sampler.sample(obj); // skipReadOnly: false
							}
							catch (ex) {
								console.error(ex);
							}
						}
						if (common.doContentType(cta, common.jsonContentTypes)) {
							content += '```json\n';
							content += JSON.stringify(obj, null, 2) + '\n';
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
							content += xml.getXml(obj, '@', '', true, '  ', false) + '\n';
							content += '```\n';
						}
					}
				}
			}
		}
	}

	data = options.templateCallback('responses', 'pre', data);
	if (data.append) { content += data.append; delete data.append; }
	content += templates.responses(data);
	data = options.templateCallback('responses', 'post', data);
	if (data.append) { content += data.append; delete data.append; }

	if (inlineSchemas && options.schema) {
		for (var resp in op.responses) {
			var response = op.responses[resp];
			for (var ct in response.content) {
				var contentType = response.content[ct];
				if (contentType.schema && !contentType.schema.$ref) {
					data.schemaProperties = [];
					data.responseStatus = resp;
					data.response = response;
					common.schemaToArray(contentType.schema,0,data.schemaProperties,true);

					data.enums = [];
					for (var prop in data.schemaProperties) {
						if (prop.schema) {
							for (var e in prop.schema.enum) {
								var nvp = {};
								nvp.name = param.name;
								nvp.value = param.schema.enum[e];
								data.enums.push(nvp);
							}
						}
					}

					data = options.templateCallback('response_schema', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.response_schema(data);
					data = options.templateCallback('response_schema', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
				}
				break; // only show one content-type for now
			}
		}
	}

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
				if (!hdr.type && hdr.schema && hdr.schema.type) {
					hdr.type = hdr.schema.type;
					hdr.format = hdr.schema.format || '';
				}

				data.response_headers.push(hdr);
			}
		}
		data = options.templateCallback('response_headers', 'pre', data);
		content += templates.response_headers(data);
		if (data.append) { content += data.append; delete data.append; }
		data = options.templateCallback('response_headers', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
	}

	var security = (op.security ? op.security : data.openapi.security);
	if (!security) security = [];
	if (security.length <= 0) {
		data = options.templateCallback('authentication_none', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.authentication_none(data);
		data = options.templateCallback('authentication_none', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
	}
	else {
		data.securityDefinitions = [];
		var list = '';
		for (var s in security) {
			var link;
			link = '#/components/securitySchemes/' + Object.keys(security[s])[0];
			var secDef = jptr.jptr(data.openapi, link);
			data.securityDefinitions.push(secDef);
			list += (list ? ', ' : '') + (secDef ? secDef.type : 'None');
			var scopes = security[s][Object.keys(security[s])[0]];
			if (Array.isArray(scopes) && (scopes.length > 0)) {
				list += ' ( Scopes: ';
				for (var scope in scopes) {
					list += scopes[scope] + ' ';
				}
				list += ')';
			}
		}
		data.authenticationStr = list;
		data = options.templateCallback('authentication', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.authentication(data);
		data = options.templateCallback('authentication', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
	}

	content += '\n';
}

// TODO: callbacks, include an enclosing div with a specific class
// TODO: links

function convert(openapi, options, callback) {

	var defaults = {};
	defaults.language_tabs = [{ 'shell': 'Shell' }, { 'http': 'HTTP' }, { 'javascript': 'JavaScript' }, { 'javascript--nodejs': 'Node.JS' }, { 'ruby': 'Ruby' }, { 'python': 'Python' }, { 'java': 'Java' }];
	defaults.codeSamples = true;
	defaults.theme = 'darkula';
	defaults.search = true;
	defaults.sample = true;
	defaults.discovery = false;
	defaults.includes = [];
	defaults.templateCallback = function (templateName, stage, data) { return data; };
	defaults.schema = true;

	options = Object.assign({}, defaults, options);
	if (!options.codeSamples) options.language_tabs = [];

	if (!templates || options.resetTemplates) {
		templates = dot.process({ path: path.join(__dirname, 'templates', 'openapi3') });
	}
	if (options.user_templates) {
		templates = Object.assign(templates, dot.process({ path: options.user_templates }));
	}

	var header = {};
	header.title = openapi.info.title + ' ' + ((openapi.info.version && openapi.info.version.toLowerCase().startsWith('v')) ? openapi.info.version : 'v' + (openapi.info.version||'?'));

	// we always show json / yaml / xml if used in content-types
	header.language_tabs = options.language_tabs;

	circles = circular.getCircularRefs(openapi, options);

	header.toc_footers = [];
	if (openapi.externalDocs) {
		if (openapi.externalDocs.url) {
			header.toc_footers.push('<a href="' + openapi.externalDocs.url + '">' + (openapi.externalDocs.description ? openapi.externalDocs.description : 'External Docs') + '</a>');
		}
	}
	header.includes = options.includes;
	header.search = options.search;
	header.highlight_theme = options.theme;

	data = {};
	data.api = data.openapi = openapi;
	data.header = header;

	content = '';

	if (openapi.servers && openapi.servers.length) {
		data.servers = openapi.servers;
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

	data.contactName = (openapi.info.contact && openapi.info.contact.name ? openapi.info.contact.name : 'Support');

	data = options.templateCallback('heading_main', 'pre', data);
	if (data.append) { content += data.append; delete data.append; }
	content += templates.heading_main(data) + '\n';
	data = options.templateCallback('heading_main', 'post', data);
	if (data.append) { content += data.append; delete data.append; }

	var securityContainer = (openapi.components && openapi.components.securitySchemes);
	if (securityContainer) {
		data.securityDefinitions = [];
		for (var s in securityContainer) {
			var secdef = securityContainer[s];
			var desc = secdef.description ? secdef.description : '';
			if (secdef.type == 'oauth2') {
				secdef.flowArray = [];
				for (var f in secdef.flows) {
					var flow = secdef.flows[f];
					flow.flowName = f;
					flow.scopeArray = [];
					for (var s in flow.scopes) {
						var scope = {};
						scope.name = s;
						scope.description = flow.scopes[s];
						flow.scopeArray.push(scope);
					}
					secdef.flowArray.push(flow);
				}
			}
			secdef.ref = s;
			if (!secdef.description) secdef.description = '';
			data.securityDefinitions.push(secdef);
		}
		data = options.templateCallback('security', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.security(data);
		data = options.templateCallback('security', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
	}

	var apiInfo = convertToToc(openapi);

	for (var r in apiInfo.resources) {
		content += '# ' + r + '\n\n';
		var resource = apiInfo.resources[r]
		if (resource.description) content += resource.description + '\n\n';

		if (resource.externalDocs) {
			if (resource.externalDocs.url) {
				content += '<a href="' + resource.externalDocs.url + '">' + (resource.externalDocs.description ? resource.externalDocs.description : 'External docs') + '</a>\n';
			}
		}

		for (var m in resource.methods) {
			var method = resource.methods[m];
			data.subtitle = method.op.toUpperCase() + ' ' + method.path;
			var op = openapi.paths[method.path][method.op];
			if ((method.op !== 'parameters') && (method.op !== 'summary') && (method.op !== 'description') &&
				(!method.op.startsWith('x-'))) {
				processOperation(op, method, resource, options);
			}
		}
	}

	if (options.schema && openapi.components && openapi.components.schemas && Object.keys(openapi.components.schemas).length>0) {
		data = options.templateCallback('schema_header', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.schema_header(data) + '\n';
		data = options.templateCallback('schema_header', 'post', data);
		if (data.append) { content += data.append; delete data.append; }

		for (let s in openapi.components.schemas) {
			content += '## '+s+'\n\n';
			content += '<a name="schema'+s.toLowerCase()+'"></a>\n\n';
			let schema = openapi.components.schemas[s];
			schema = common.dereference(schema, circles, openapi, common.clone)

			var obj = schema;
			if (options.sample) {
				try {
					obj = sampler.sample(obj); // skipReadOnly: false
				}
				catch (ex) {
					console.error(ex);
				}
			}

			data.schema = obj;
			data = options.templateCallback('schema_sample', 'pre', data);
			if (data.append) { content += data.append; delete data.append; }
			content += templates.schema_sample(data) + '\n';
			data = options.templateCallback('schema_sample', 'post', data);
			if (data.append) { content += data.append; delete data.append; }

			data.schema = schema;
			data.enums = [];
			data.schemaProperties = [];
			common.schemaToArray(schema,0,data.schemaProperties,true);

			for (let p of data.schemaProperties) {
				if (p.schema && p.schema.enum) {
					for (let e of p.schema.enum) {
						data.enums.push({name:p.name,value:e});
					}
				}
			}

			data = options.templateCallback('schema_properties', 'pre', data);
			if (data.append) { content += data.append; delete data.append; }
			content += templates.schema_properties(data) + '\n';
			data = options.templateCallback('schema_properties', 'post', data);
			if (data.append) { content += data.append; delete data.append; }

		}
	}

	data = options.templateCallback('footer', 'pre', data);
	if (data.append) { content += data.append; delete data.append; }
	content += templates.footer(data) + '\n';
	data = options.templateCallback('footer', 'post', data);
	if (data.append) { content += data.append; delete data.append; }

	if (options.discovery) {
		data = options.templateCallback('discovery', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.discovery(data) + '\n';
		data = options.templateCallback('discovery', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
	}

	var headerStr = '---\n' + yaml.safeDump(header) + '---\n';
	// apparently you can insert jekyll front-matter in here for github
	// see https://github.com/lord/slate/issues/702
	var result = (headerStr + '\n' + content.split('\n\n\n').join('\n\n'));
	if (callback) callback(null, result);
	return result;
}

module.exports = {
	convert: convert
};
