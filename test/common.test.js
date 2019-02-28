'use strict';

const assert = require('assert');
const common = require('../lib/common');
const schema = {};
const offset = {};
const options = {};
const data = {};


describe('common tests', () => {
    describe('schemaToArray tests', () => {
        it('should ', () => {
            assert(common.schemaToArray(schema,offset,options,data)).isBoolean();
        });
    });
});

