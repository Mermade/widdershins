'use strict';

const assert = require('assert');
const common = require('../lib/common');

const blank = { title: '', rows: [], description: undefined };

const schema0 = {};
const schema1 = {
    properties: {
        firstName: {
            type: 'string',
            description: 'your name'
        }
    }
};
const schema4 = {
    type: 'object',
    description: '',
    properties:
        {
            id:
                {
                    type: 'string',
                    description: 'a id string'
                },
            data: {
                type: 'object',
                properties: {
                    name: {
                        type: 'object'
                    },
                    properties: {
                        first: {
                            type: 'string'
                        },
                        last: {
                            type: 'string'
                        }
                    }
                }
            }
        }
};
const array = {
    type: 'array',
    description: '',
    items:
        {
            type: 'object',
            description: '',
            properties:
                {
                    key: [ Object ],
                    message: [ Object ],
                    error: [ Object ],
                    status: [ Object ]
                }
        }
};

describe('common tests', () => {
    describe('schemaToArray tests', () => {
        it('should return a blank container if all inputs are blank', () => {
            const schema = {};
            const offset = 0;
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

        it('should create a row for each property and subproperty', () => {
            const offset = 0;
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

        it('should calculate depth properly', () => {
            const offset = 0;
            const options = {};
            const data = {
                'translations': {
                    'indent': {
                        'repeat': () => {
                        }
                    }
                }
            };
            assert.equal(common.schemaToArray(schema1, offset, options, data)[ 0 ].rows[ 0 ].depth, 1);
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[ 0 ].depth, 1);
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[ 1 ].depth, 1);
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[ 2 ].depth, 2);
            //This test is failing given should be fixed by PR #154
            // assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[3].depth, 3);
        });

        it('should create a name for each row', () => {
            const offset = 0;
            const options = {};
            const data = {
                'translations': {
                    'indent': {
                        'repeat': () => {
                        }
                    }
                }
            };
            assert.equal(common.schemaToArray(schema1, offset, options, data)[ 0 ].rows[ 0 ].name, 'firstName');
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[0].name, 'id');
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[1].name, 'data');
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[2].name, 'name');
            assert.equal(common.schemaToArray(schema4, offset, options, data)[ 0 ].rows[3].name, 'properties');
        });
    });
});

