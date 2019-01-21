'use strict';

const openapi2 = require('./openapi2.js');
const openapi3 = require('./openapi3.js');
const asyncapi1 = require('./asyncapi1.js');
const semoasa = require('./semoasa.js');
const apiblueprint = require('./apiblueprint.js');

function convert(api, options, callback) {

    options.samplerErrors = new Map();

    if (typeof api === 'string') {
        apiblueprint.convert(api, options, callback);
    }
    else if (api.swagger) {
        openapi2.convert(api, options, callback);
    }
    else if (api.openapi) {
        openapi3.convert(api, options, callback);
    }
    else if (api.asyncapi) {
        asyncapi1.convert(api, options, callback);
    }
    else if (api.openapiExtensionFormat) {
        semoasa.convert(api, options, callback);
    }
    else {
        callback(new Error('Unrecognised input format'));
    }
}

module.exports = {
    convert: convert
};
