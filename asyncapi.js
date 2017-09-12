'use strict';

var up = require('url');
var path = require('path');
var util = require('util');

var common = require('./common.js');

var yaml = require('js-yaml');
var xml = require('jgexml/json2xml.js');
var jptr = require('jgexml/jpath.js');
var circular = require('openapi_optimise/circular.js');
var sampler = require('openapi-sampler');
var dot = require('dot');
dot.templateSettings.strip = false;
dot.templateSettings.varname = 'data';
var templates;

var circles = [];
var content = '';

/**
* function to reformat asyncapi topics object into an iodocs-style resources object, tags-first
*/
function convertToToc(source) {
	var apiInfo = common.clone(source, false);
	apiInfo.resources = {};
	for (var t in apiInfo.topics) {
		for (var m in apiInfo.topics[t]) {
			var sMessage = apiInfo.topics[t][m];
			if (sMessage.$ref) {
				sMessage = common.dereference(sMessage, circles, source, common.clone);
			}
			var ioMessage = {};
			ioMessage.topic = t;
			ioMessage.message = m;
			var sMessageUniqueName = (m + '_' + t).split('/').join('_');
			sMessageUniqueName = sMessageUniqueName.split(' ').join('_'); // TODO {, } and : ?
			var tagName = 'Default';
			if (sMessage.tags && sMessage.tags.length > 0) {
				tagName = sMessage.tags[0].name;
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
			if (!apiInfo.resources[tagName].messages) apiInfo.resources[tagName].messages = {};
			apiInfo.resources[tagName].messages[sMessageUniqueName] = ioMessage;
		}
	}
	delete apiInfo.paths; // to keep size down
	delete apiInfo.definitions; // ditto
	delete apiInfo.components; // ditto
	return apiInfo;
}

function processObject(obj, options, asyncapi) {
	obj = common.dereference(obj, circles, asyncapi, common.clone);

	var xmlWrap = '';
	if (obj && obj.xml && obj.xml.name) {
		xmlWrap = obj.xml.name;
	}
	if (Object.keys(obj).length > 0) {

		if (options.sample) {
			try {
				obj = sampler.sample(obj); // skipReadOnly: false
			}
			catch (ex) {
				console.log('# ' + ex);
			}
		}
		content += '```json\n';
		content += JSON.stringify(obj, null, 2) + '\n';
		content += '```\n';
		if (xmlWrap) {
			var newObj = {};
			newObj[xmlWrap] = obj;
			obj = newObj;
		}
		if ((typeof obj === 'object') && xmlWrap) {
			content += '```xml\n';
			content += xml.getXml(obj, '@', '', true, '  ', false) + '\n';
			content += '```\n';
		}
	}

	var result = {};
	result.obj = obj;
	result.str = util.inspect(obj);
	result.json = JSON.stringify(obj, null, 2);
	return result;
}

function convert(asyncapi, options, callback) {

	var defaults = {};
	defaults.language_tabs = [{ 'javascript--nodejs': 'Node.JS' },{ 'javascript': 'JavaScript' }, { 'ruby': 'Ruby' }, { 'python': 'Python' }, { 'java': 'Java' }, { 'go': 'Go'}];
	defaults.codeSamples = true;
	defaults.theme = 'darkula';
	defaults.search = true;
	defaults.sample = true;
	defaults.discovery = false;
	defaults.includes = [];
	defaults.templateCallback = function (templateName, stage, data) { return data; };
	defaults.schema = true;

	options = Object.assign({}, defaults, options);
	if (!options.codeSamples) defaults.language_tabs = [];

	if (typeof templates === 'undefined') {
		templates = dot.process({ path: path.join(__dirname, 'templates', 'asyncapi') });
	}
	if (options.user_templates) {
		templates = Object.assign(templates, dot.process({ path: options.user_templates }));
	}

	var header = {};
	header.title = asyncapi.info.title + ' ' + ((asyncapi.info.version && asyncapi.info.version.toLowerCase().startsWith('v')) ? asyncapi.info.version : 'v' + (asyncapi.info.version||'?'));

	// we always show json / yaml / xml if used in headers/payloads
	header.language_tabs = options.language_tabs;

	circles = circular.getCircularRefs(asyncapi, options);

	header.toc_footers = [];
	if (asyncapi.externalDocs) {
		if (asyncapi.externalDocs.url) {
			header.toc_footers.push('<a href="' + asyncapi.externalDocs.url + '">' + (asyncapi.externalDocs.description ? asyncapi.externalDocs.description : 'External Docs') + '</a>');
		}
	}
	header.includes = options.includes;
	header.search = options.search;
	header.highlight_theme = options.theme;

	var data = {};
	data.api = data.asyncapi = data.openapi = asyncapi;
	data.baseTopic = asyncapi.baseTopic;
	data.header = header;

	content = '';

	if (asyncapi.servers && asyncapi.servers.length) {
		data.servers = asyncapi.servers;
	}
	else if (options.loadedFrom) {
		data.servers = [{url:options.loadedFrom}];
	}
	else {
		data.servers = [{url:'//'}];
	}

	data.contactName = (asyncapi.info.contact && asyncapi.info.contact.name ? asyncapi.info.contact.name : 'Support');

	data = options.templateCallback('heading_main', 'pre', data);
	if (data.append) { content += data.append; delete data.append; }
	content += templates.heading_main(data) + '\n';
	data = options.templateCallback('heading_main', 'post', data);
	if (data.append) { content += data.append; delete data.append; }

	var apiInfo = convertToToc(asyncapi);

	for (var r in apiInfo.resources) {
		content += '# ' + r + '\n\n'; // TODO template
		var resource = apiInfo.resources[r]
		if (resource.description) content += resource.description + '\n\n';

		if (resource.externalDocs) {
			if (resource.externalDocs.url) { // TODO template
				content += '<a href="' + resource.externalDocs.url + '">' + (resource.externalDocs.description ? resource.externalDocs.description : 'External docs') + '</a>\n';
			}
		}

		for (var m in resource.messages) {
			var message = resource.messages[m];
			var subtitle = message.message + ' ' + asyncapi.baseTopic + '.' + message.topic;
			var msg = asyncapi.topics[message.topic][message.message];
			if (!message.message.startsWith('x-')) {

				var opName = subtitle;
				content += '## ' + opName + '\n\n'; // TODO template

				if (msg.$ref) {
					msg = common.dereference(msg, circles, asyncapi, common.clone);
				}

				if (msg.deprecated) {
					content += 'Note: **Deprecated**\n\n'; // TODO template
				}

				var topic = data.baseTopic + '.' + message.topic;

				data.message = data.method = message.message;
				data.topic = topic;
				data.operation = message;
				data.tags = asyncapi.topics[message.topic][message.message].tags;
				data.security = asyncapi.topics[message.topic][message.message].security;
				data.resource = resource;

				if (msg.headers) {
					data = options.templateCallback('heading_example_headers', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.heading_example_headers(data) + '\n';
					data = options.templateCallback('heading_example_headers', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
					data.headers = processObject(msg.headers, options, asyncapi);
				}

				if (msg.payload) {
					data = options.templateCallback('heading_example_payload', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.heading_example_payload(data) + '\n';
					data = options.templateCallback('heading_example_payload', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
					data.payload = processObject(msg.payload, options, asyncapi);

				}

				var codeSamples = (options.codeSamples || msg["x-code-samples"]);
				if (codeSamples) {
					data = options.templateCallback('heading_code_samples', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.heading_code_samples(data);
					data = options.templateCallback('heading_code_samples', 'post', data);
					if (data.append) { content += data.append; delete data.append; }

					if (msg["x-code-samples"]) {
						for (var s in msg["x-code-samples"]) {
							var sample = msg["x-code-samples"][s];
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
                                var templateName = 'code_' + lcLang.substring(lcLang.lastIndexOf('-') + 1);
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

				if (subtitle != opName) content += '`' + subtitle + '`\n\n';

				if (msg.summary) content += '*' + msg.summary + '*\n\n'; // TODO template
				if (msg.description) content += msg.description + '\n\n';

				if (msg.headers && options.schema) {
					data.properties = [];
					data.enums = [];
					common.schemaToArray(msg.headers,0,data.properties,true);

					data = options.templateCallback('header_properties', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.header_properties(data) + '\n';
					data = options.templateCallback('header_properties', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
				}

				if (msg.payload && options.schema) {
					data.properties = [];
					data.enums = [];
					common.schemaToArray(msg.payload,0,data.properties,true);

					data = options.templateCallback('payload_properties', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.payload_properties(data) + '\n';
					data = options.templateCallback('payload_properties', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
				}

				var security = (msg.security ? msg.security : asyncapi.security);
				if (!security) security = [];
				if (security.length <= 0) {
					data = options.templateCallback('authentication_none', 'pre', data);
					if (data.append) { content += data.append; delete data.append; }
					content += templates.authentication_none(data);
					data = options.templateCallback('authentication_none', 'post', data);
					if (data.append) { content += data.append; delete data.append; }
				}

				content += '\n';

			}
		}
	}

    if (options.schema && asyncapi.components && asyncapi.components.schemas && Object.keys(asyncapi.components.schemas).length>0) {
        data = options.templateCallback('schema_header', 'pre', data);
        if (data.append) { content += data.append; delete data.append; }
        content += templates.schema_header(data) + '\n';
        data = options.templateCallback('schema_header', 'post', data);
        if (data.append) { content += data.append; delete data.append; }

        for (let s in asyncapi.components.schemas) {
            content += '## '+s+'\n\n';
            content += '<a name="schema'+s.toLowerCase()+'"></a>\n\n';
            let schema = asyncapi.components.schemas[s];
			schema = common.dereference(schema, circles, asyncapi, common.clone);

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

	if (options.discovery) {
		data = options.templateCallback('discovery', 'pre', data);
		if (data.append) { content += data.append; delete data.append; }
		content += templates.discovery(data) + '\n';
		data = options.templateCallback('discovery', 'post', data);
		if (data.append) { content += data.append; delete data.append; }
	}

	data = options.templateCallback('footer', 'pre', data);
	if (data.append) { content += data.append; delete data.append; }
	content += templates.footer(data) + '\n';
	data = options.templateCallback('footer', 'post', data);
	if (data.append) { content += data.append; delete data.append; }

	var headerStr = '---\n' + yaml.safeDump(header) + '---\n';
	// apparently you can insert jekyll front-matter in here for github
	// see https://github.com/lord/slate/issues/70
	var result = (headerStr + '\n' + content.split('\n\n\n').join('\n\n'));
	if (callback) callback(null, result);
	return result;
}

module.exports = {
	convert: convert
};
