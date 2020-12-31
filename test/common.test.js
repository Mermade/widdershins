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
const schema2 = {
    type: 'object',
    description: '',
    properties: {
        id: {
            type: 'string',
            description: 'an id string'
        },
        data: {
            type: 'object',
            properties: {
                name: {
                   type: 'object',
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
        },
        _links: {
            type: 'array',
            items: {
                type: 'string'
            }
        }
    }
};

const data = {
    'translations': {
        'indent': '»'
    }
};

describe('common tests', () => {
    describe('slugify tests', () => {
        it('should replace all & symbols', () => {
            assert.equal(common.slugify('this & this'), 'this-and-this');
        });
        it('should remove all parentheses', () => {
            assert.equal(common.slugify('title (plus more)'), 'title-plus-more');
        });
        it('should remove colons, commas and aposrophes', () => {
            assert.equal(common.slugify('id: one'), 'id-one');
            assert.equal(common.slugify('another, id'), 'another-id');
            assert.equal(common.slugify('id\'s title'), 'ids-title');
        });
        it('should remove code tags', () => {
            assert.equal(common.slugify('<code>id here</code>'), 'id-here');
        });
        it('should replace remaining non-word characters and dashes with a single dash (-)', () => {
            assert.equal(common.slugify('id: one, two & three'), 'id-one-two-and-three');
        });
        it('should replace chinese characters with pinyin', () => {
            assert.equal(common.slugify('id: one, 二 & 三'), 'id-one-er4-and-san1');
        });
    });
    describe('schemaToArray tests', () => {
        it('should return a blank container if all inputs are blank', () => {
            const schema = {};
            const offset = 0;
            const options = {};
            const result = common.schemaToArray(schema0, offset, options, data);
            assert.equal(result[0].title, '');
            assert.equal(result[0].rows[0], undefined);
            assert.equal(result[0].description, undefined);
        });

        it('should create a row for each property and subproperty', () => {
            const offset = 0;
            const options = {};
            assert.equal(common.schemaToArray(schema1, offset, options, data)[0].rows.length, 1);
            assert.equal(common.schemaToArray(schema2, offset, options, data)[0].rows.length, 6);
        });

        it('should calculate depth properly', () => {
            const offset = 0;
            const options = {};
            assert.equal(common.schemaToArray(schema1, offset, options, data)[0].rows[0].depth, 1);
            const result = common.schemaToArray(schema2, offset, options, data);
            assert.equal(result[0].rows[0].depth, 1);
            assert.equal(result[0].rows[1].depth, 1);
            assert.equal(result[0].rows[2].depth, 2);
            assert.equal(result[0].rows[3].depth, 3);
            assert.equal(result[0].rows[4].depth, 3);
            assert.equal(result[0].rows[5].depth, 1);
        });

        it('should create a name for each row', () => {
            const offset = 0;
            const options = {};
            assert.equal(common.schemaToArray(schema1, offset, options, data)[0].rows[0].name, 'firstName');
            const result = common.schemaToArray(schema2, offset, options, data);
            assert.equal(result[0].rows[0].name, 'id');
            assert.equal(result[0].rows[1].name, 'data');
            assert.equal(result[0].rows[2].name, 'name');
            assert.equal(result[0].rows[3].name, 'first');
            assert.equal(result[0].rows[4].name, 'last');
            assert.equal(result[0].rows[5].name, '_links');
        });
    });
});

