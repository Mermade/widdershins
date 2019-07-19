'use strict';

const openapi3 = require('./openapi3.js');
const swagger2openapi = require('swagger2openapi');

function convert(api, options, callback) {
    swagger2openapi.convertObj(api, {patch:true,warnOnly:true,resolve:options.resolve,verbose:options.verbose,source:options.source, rbname: options.useBodyName ? 'x-body-name' : ''}, function(err, sOptions) {
        if (err) {
            if (options.verbose) {
                console.error(err);
            }
            else {
                console.error(err.message);
            }
            return callback(err);
        }
        else {
            options.resolve = false; // done now
            openapi3.convert(sOptions.openapi, options, callback);
        }
    });
}

module.exports = {
    convert : convert
};
