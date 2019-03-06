'use strict';

const assert = require('assert');
const common = require('../lib/common');

const blank = { title: '', rows: [], description: undefined };

const schema0 = {};
const schema1 = {
    type: 'string',
    description: ''
};
const schema4 = {
    type: 'object',
    description: '',
    properties:
        {
            id:
                {
                    type: 'string'
                },
            data: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string'
                    },
                    number: {
                        type: 'string'
                    }
                }
            }
        }
};

describe('common tests', () => {
    describe('schemaToArray tests', () => {
        it('should return a blank container if all inputs are blank', () => {
            const schema = {};
            const offset = '';
            const options = {};
            const data = {
                'translations': {
                    'indent': {
                        'repeat': () => {
                        }
                    }
                }
            };
            assert.equal(common.schemaToArray(schema0, offset, options, data)[ 0 ].title, '');
            assert.equal(common.schemaToArray(schema0, offset, options, data)[ 0 ].rows[ 0 ], undefined);
            assert.equal(common.schemaToArray(schema0, offset, options, data)[ 0 ].description, undefined);
        });

        it('should create a row for each property', () => {
            const offset = 1;
            const options = {};
            const data = {
                'translations': {
                    'indent': {
                        'repeat': () => {
                        }
                    }
                }
            };
            assert.equal(common.schemaToArray(schema1, offset, options, data)[ 0 ].rows.length, 1);
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows.length, 4);
        });
    });
});

