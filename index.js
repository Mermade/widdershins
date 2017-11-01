'use strict';

const openapi2 = require('./openapi2.js');
const openapi3 = require('./openapi3.js');
const openapix = require('./openapix.js');
const asyncapi = require('./asyncapi.js');
const semoasa = require('./semoasa.js');

function convert(api, options, callback) {

    if (typeof api === 'string') {
        let apiblueprint = require('./apiblueprint.js');
        apiblueprint.convert(api, options, callback);
    }
    else if (api.swagger) {
        openapi2.convert(api, options, callback);
    }
    else if (api.openapi) {
        if (options.experimental) {
            openapix.convert(api, options, callback);
        }
        else {
            openapi3.convert(api, options, callback);
        }
    }
    else if (api.asyncapi) {
        asyncapi.convert(api, options, callback);
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
