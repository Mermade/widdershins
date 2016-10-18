# widdershins
OpenApi / Swagger definition to [Slate](https://github.com/lord/slate) / 
[Shins](https://github.com/mermade/shins) compatible markdown

![Build](https://img.shields.io/travis/Mermade/widdershins.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://mermade.github.io/openapi_optimise/tested.svg)](https://github.com/mermade/openapi_specifications)

<img src="http://mermade.github.io/widdershins/logo.png" width="247px" height="250px" />

### Widdershins *adverb*:
* In a direction contrary to the sun's course;
* anticlockwise;
* helping you produce static documentation from your OpenApi / Swagger 2.0 definition

Widdershins supports the `x-code-samples` [vendor-extension](https://github.com/Rebilly/ReDoc/blob/master/docs/redoc-vendor-extensions.md#operation-object-vendor-extensions) to completely customise your documentation.

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
options.theme = 'darkula';
var str = converter.convert(swaggerObj,options);
````

`loadedFrom` option is only needed where the OpenApi / Swagger definition does not specify a host,
and (as per the OpenApi [specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#fixed-fields)) the API endpoint is deemed to be based on the source URL
the definition was loaded from.

To see the list of highlight-js syntax highlighting themes, [click here](https://highlightjs.org/static/demo/)

## Tests

To run a test-suite:

````
node testRunner {path-to-APIs}
````

The test harness currently expects files named `swagger.yaml` or `swagger.json` and has been tested
against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi specifications collection](https://github.com/mermade/openapi_specifications)

### Acknowledgements

Thanks to @latgeek for the logo.
