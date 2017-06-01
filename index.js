var openapi2 = require('./openapi2.js');
var openapi3 = require('./openapi3.js');
var asyncapi = require('./asyncapi.js');

function convert(api, options, callback) {

	if (api.swagger) {
		openapi2.convert(api, options, callback);
	}
	else if (swagger.openapi) {
		openapi3.convert(api, options, callback);
	}
	else if (swagger.asyncapi) {
		asyncapi.convert(api, options, callback);
	}
	else {
		callback(new Error('Unrecognised input format'));
	}
}

module.exports = {
	convert: convert
};
