'use strict';

var openapi3 = require('./openapi3.js');
var openapix = require('./openapix.js');
var swagger2openapi = require('swagger2openapi');

function convert(api, options, callback) {
    swagger2openapi.convertObj(api, {patch:true}, function(err, sOptions) {
        if (err) {
            console.error(err.message);
        }
        else {
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
