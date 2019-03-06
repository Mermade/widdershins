'use strict';

const assert = require('assert');
const common = require('../lib/common');

const blank = { title: '', rows: [], description: undefined };

describe('common tests', () => {
    describe('schemaToArray tests', () => {

        it('should return a blank container if all inputs are blank', () => {
            const schema = {};
            const offset = '';
            const options = {};
            const data = {
                "translations": {
                    "indent": {
                        "repeat": () => {}
                    }
                }
            };
            assert.equal(common.schemaToArray(schema, offset, options, data)[0].title, '');
            assert.equal(common.schemaToArray(schema, offset, options, data)[0].rows[0], undefined);
            assert.equal(common.schemaToArray(schema, offset, options, data)[0].description, undefined);
        });

        it('should properly offset values', () => {
            const schema = {
                    "openapi": "3.0.0",
                    "info": {
                        "version": "",
                        "title": "Widdershins API Example"
                    }
                };
            const offset = 1;
            const options = {};
            const data = {
                "translations": {
                    "indent": {
                        "repeat": () => {}
                    }
                }
            };
            assert.equal(common.schemaToArray(schema, offset, options, data)[0].title, '');
        });
    });
});

