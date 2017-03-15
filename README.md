# widdershins
OpenApi / Swagger definition to [Slate](https://github.com/lord/slate) / 
[Shins](https://github.com/mermade/shins) compatible markdown

![Build](https://img.shields.io/travis/Mermade/widdershins.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://img.shields.io/badge/Additional%20Specs-419-brightgreen.svg)](https://github.com/mermade/openapi_specifications)
[![Known Vulnerabilities](https://snyk.io/test/npm/widdershins/badge.svg)](https://snyk.io/test/npm/widdershins)

<img src="http://mermade.github.io/widdershins/logo.png" width="247px" height="250px" />

### Widdershins *adverb*:
* In a direction contrary to the sun's course;
* anticlockwise;
* helping you produce static documentation from your OpenApi / Swagger 2.0 definition

![Widdershins screenshot](https://github.com/Mermade/oa2s-comparison/blob/master/docs/widdershins.png?raw=true)

Widdershins supports the `x-code-samples` [vendor-extension](https://github.com/Rebilly/ReDoc/blob/master/docs/redoc-vendor-extensions.md#operation-object-vendor-extensions) to completely customise your documentation. Alternatively, you can edit the default code-samples in the `templates` sub-directory, or override them using the `user_templates` option to specify a directory containing your templates.

Widdershins supports the use of multiple language tabs with the same language (i.e. plain Javascript and Node.Js). To use this support you must be using Slate (or one of its ports compatible with) version 1.5.0 or higher. [Shins](https://github.com/mermade/shins) versions track Slate version numbers.

### To install

* Clone the git repository, or
* `npm install [-g] widdershins`, or
* `yarn global add widdershins`

````
node widdershins [options] {input-spec} [[-o] output markdown]

Options:
  -h, --help       Show help                                           [boolean]
  --version        Show version number                                 [boolean]
  -y, --yaml       Load spec in yaml format, default json              [boolean]
  -c, --code       Turn generic code samples off                       [boolean]
  -d, --discovery  Include schema.org WebAPI discovery data            [boolean]
  -i, --includes   List of files to include, comma separated            [string]
  -l, --lang       Automatically generate list of languages for code samples
                                                                       [boolean]
  -o, --outfile    File to write output markdown to                     [string]
  -r, --raw        Output raw schemas not example values               [boolean]
  -s, --search     Whether to enable search, defaults to true          [boolean]
  -t, --theme      Syntax-highlighter theme to use                      [string]
  -u, --user_templates  directory to load override templates from       [string]
````

or


````javascript
var converter = require('widdershins');
var options = {}; // defaults shown
options.codeSamples = true;
//options.language_tabs = [];
//options.loadedFrom = sourceUrl;
//options.user_templates = './user_templates';
options.templateCallback = function(templateName,stage,data) { return data };
options.theme = 'darkula';
options.search = true;
options.sample = true; // set false by --raw
options.discovery = false;
options.includes = [];
var str = converter.convert(swaggerObj,options);
````

`loadedFrom` option is only needed where the OpenApi / Swagger definition does not specify a host,
and (as per the OpenApi [specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#fixed-fields)) the API endpoint is deemed to be based on the source URL
the definition was loaded from.

Note that the list of included files is simply passed into the header of the markdown file, they are actually included by Slate or the alternative you use.

To see the list of highlight-js syntax highlighting themes, [click here](https://highlightjs.org/static/demo/)

Schema.org WebAPI discovery data is included if the options above are set. See the W3C [WebAPI Discovery Community Group](https://www.w3.org/community/web-api-discovery/) for more information.

## Template parameters

Templates are compiled with [doT.js](https://github.com/olado/doT#readme).

Templates have access to a `data` object with a range of properties based on the document context.

If you specify an `options.templateCallback` function, it will be called before and after each template, with three parameters, the template name, the stage, (`'pre'` or `'post'`) and the current `data` object. You can mutate the `data` object in any way you see fit, as long as you `return` it. Content in the `data.append` property will be appended to the current output stream.

### Code templates

* `method` - the HTTP method of the operation (in lower-case)
* `methodUpper` - the HTTP method of the operation (in upper-case)
* `url` - the full URL of the operation (including protocol and host)
* `consumes[]` - an array of MIME-types the operation consumes
* `produces[]` - an array of MIME-types the operation produces
* `operation` - the current operation object
* `operationId` - the current operation id
* `tags[]` - the full list of tags applying to the operation
* `security` - the security definitions applying to the operation
* `resource` - the current tag/path object
* `parameters[]` - an array of parameters for the operation (see below)
* `queryString` - an example queryString, urlEncoded
* `requiredQueryString` - an example queryString for `required:true` parameters
* `queryParameters[]` - a subset of `parameters` that are `in:query`
* `requiredParameters[]` - a subset of `queryParameters` that are `required:true`
* `headerParameters[]` - a subset of `parameters` that are `in:header`
* `allHeaders[]` - a concatenation of `headerParameters` and pseudo-parameters `Accept` and `Content-Type`

### Parameter template

* `parameters[]` - an array of parameters, including the following pseudo-properties
    * `shortDesc` - a truncated version of the parameter description
    * `safeType` - a computed version of the parameter type, including Body and schema names
    * `originalType` - the original type of the parameter
    * `exampleValues` - an object containing examples for use in code-templates
        * `json` - example values in JSON compatible syntax
        * `object` - example values in raw object form (unquoted strings etc)
* `enums[]` - an array of (parameter)name/value pairs

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

Thanks to @latgeek for the logo

### Widdershins in the wild

Please feel free to add a link to your API documentation here
