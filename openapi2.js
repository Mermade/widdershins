'use strict';

const openapi3 = require('./openapi3.js');
const openapix = require('./openapix.js');
const swagger2openapi = require('swagger2openapi');

function convert(api, options, callback) {
    swagger2openapi.convertObj(api, {patch:true,warnOnly:true,resolve:options.resolve}, function(err, sOptions) {
        if (err) {
            console.error(err.message);
        }
        else {
            options.resolve = false; // done now
            if (options.experimental) {
                openapix.convert(sOptions.openapi, options, callback);
            }
            else {
                openapi3.convert(sOptions.openapi, options, callback);
            }
        }
    });
}

module.exports = {
    convert : convert
};
