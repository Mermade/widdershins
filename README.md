# widdershins
OpenApi / Swagger definition to [Slate](https://github.com/lord/slate) / 
[Shins](https://github.com/mermade/shins) compatible markdown

![Build](https://img.shields.io/travis/Mermade/widdershins.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://mermade.github.io/openapi_optimise/tested.svg)](https://github.com/mermade/openapi_specifications)
[![Known Vulnerabilities](https://snyk.io/test/npm/widdershins/badge.svg)](https://snyk.io/test/npm/widdershins)

<img src="http://mermade.github.io/widdershins/logo.png" width="247px" height="250px" />

### Widdershins *adverb*:
* In a direction contrary to the sun's course;
* anticlockwise;
* helping you produce static documentation from your OpenApi / Swagger 2.0 definition

![Widdershins screenshot](https://github.com/Mermade/oa2s-comparison/blob/master/docs/widdershins.png?raw=true)

Widdershins supports the `x-code-samples` [vendor-extension](https://github.com/Rebilly/ReDoc/blob/master/docs/redoc-vendor-extensions.md#operation-object-vendor-extensions) to completely customise your documentation. Alternatively, you can edit the default code-samples in the `templates` sub-directory, or override them using the `user_templates` option to specify a directory containing your templates.

### To install

* Clone the git repository, or
* `npm install widdershins`, or
* `yarn install -g widdershins`

````
widdershins [options] {input-spec} [[-o] output markdown]

Options:
  -h, --help     Show help                                             [boolean]
  --version      Show version number                                   [boolean]
  -y, --yaml     Load spec in yaml format, default json                [boolean]
  -c, --code     Turn generic code samples off                         [boolean]
  -l, --lang     Automatically generate list of languages for code samples
                                                                       [boolean]
  -o, --outfile  file to write output markdown to                       [string]
  -t, --theme    Syntax-highlighter theme to use                        [string]
````

or


````javascript
var converter = require('widdershins');
var options = {}; // defaults shown
options.codeSamples = true;
//options.language_tabs = [];
//options.loadedFrom = sourceUrl;
//options.user_templates = './user_templates';
options.theme = 'darkula';
var str = converter.convert(swaggerObj,options);
````

`loadedFrom` option is only needed where the OpenApi / Swagger definition does not specify a host,
and (as per the OpenApi [specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#fixed-fields)) the API endpoint is deemed to be based on the source URL
the definition was loaded from.

To see the list of highlight-js syntax highlighting themes, [click here](https://highlightjs.org/static/demo/)

## Template parameters

Templates are compiled with [doT.js](https://github.com/olado/doT#readme).

Templates have access to a `data` object with a range of properties based on the document context.

### Code templates

* `method` - the HTTP method of the operation (in lower-case)
* `methodUpper` - the HTTP method of the operation (in upper-case)
* `url` - the full URL of the operation (including protocol and host)
* `parameters[]` - an array of parameters for the operation
* `consumes[]` - an array of MIME-types the operation consumes
* `produces[]` - an array of MIME-types the operation produces
* `operation` - the current operation object
* `resource` - the current tag/path object

### Parameter template

* `parameters[]` - an array of parameters, including a `shortDesc` property

### Responses template

* `responses[]` - an array of responses, including `status` and `meaning` properties

### Authentication template

* `authenticationStr` - a simple string of methods (and scopes where appropriate)
* `securityDefinitions[]` - an array of applicable securityDefinitions

### Common to all templates

* `openapi` - the top-level OpenApi / Swagger document
* `header` - the front-matter of the Slate/Shins markdown document
* `host` - the (computed) host of the API
* `protocol` - the default/first protocol of the API
* `baseUrl` - the (computed) baseUrl of the API (including protocol and host)

## Tests

To run a test-suite:

````
node testRunner {path-to-APIs}
````

The test harness currently expects files named `swagger.yaml` or `swagger.json` and has been tested
against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)

### Comparison between this and other OpenAPI / Swagger to Slate tools

[Blog posting](http://mikeralphson.github.io/openapi/2016/12/19/oa2s-comparison) by the author of Widdershins

### Acknowledgements

Thanks to @latgeek for the logo.
