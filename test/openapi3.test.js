'use strict';
const assert = require('assert');
const openapi3 = require('../lib/openapi3');
const exampleEnv = require('../example_env.json');
const oasSpec = require('./testData/oas3Petstore.json');
const data = require('./testData/data.json');

const options =
    {
        'omitBody': true,
        'expandBody': false
    };
const operation =
    {
        'requestBody': {
            'required': false,
            'description': 'This is a description'
        }
    };
const bodyParameter =
    {
        'refName': 'name of reference',
        'schema': {
            'type': 'object',
            'properties':
                {
                    'id':
                        {
                            'type': 'string',
                            'description': 'The fake ID'
                        }
                }
        }
    };

const noOptions = {
    'options': {},
    'operation': operation,
    'parameters': [],
    'bodyParameter': bodyParameter,
    'translations': {
        'indent': ''
    }
};

const noOperation = {
    'options': options,
    'operation': {},
    'parameters': [],
    'bodyParameter': bodyParameter,
    'translations': {
        'indent': ''
    }
};

const goodData =
    {
        'options': options,
        'operation': operation,
        'parameters': [],
        'bodyParameter': bodyParameter,
        'translations': {
            'indent': ''
        }
    };

describe('openapi3 tests', () => {
    describe('fakeBodyParameter', () => {
        it('should handle empty options', () => {
            assert.doesNotThrow(() => openapi3.fakeBodyParameter(noOptions));
        });

        it('should handle empty operation', () => {
            assert.doesNotThrow(() => openapi3.fakeBodyParameter(noOperation));
        });

        it('should append parameters to data.parameters', () => {
            openapi3.fakeBodyParameter(goodData);
            assert.deepStrictEqual(goodData.parameters.length, 1);
        });
    });

    describe('getTagGroup', () => {
        let test = null;
        it('should handle no tag groups', () => {
            assert.doesNotThrow(() => openapi3.getTagGroup('fake tag', null));
        });
        it('should handle wrong tags ', () => {
            assert.doesNotThrow(() => openapi3.getTagGroup('fake tag', exampleEnv.tagGroups));
            let result = openapi3.getTagGroup('fake tag', exampleEnv.tagGroups);
            assert.deepStrictEqual(result.name,'fake tag');
            assert.deepStrictEqual(result.description, '');
        });
        it('should get the proper title & description from the tag group', () => {
            let result = openapi3.getTagGroup('invoice-create', exampleEnv.tagGroups);
            assert.deepStrictEqual(result.name, 'Billing');
            assert.deepStrictEqual(result.description, 'billing apis');
        });
    });

    describe('convertToToc', () => {
        let resources = openapi3.convertToToc(oasSpec, data);
        it('should return a pets object with count, methods and description', () => {
            assert(resources.pets);
            assert(resources.pets.count);
            assert(resources.pets.methods);
            assert.deepStrictEqual(resources.pets.description, '');
        });
        it('methods object should include `listPets`, `createPets`, and `showPetById`', () => {
            assert(resources.pets.methods.listPets);
            assert(resources.pets.methods.createPets);
            assert(resources.pets.methods.showPetById);
        });
    });
});
