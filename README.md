# widdershins
OpenApi / Swagger / AsyncAPI definition to [Slate](https://github.com/lord/slate) /
[Shins](https://github.com/mermade/shins) compatible markdown

![Build](https://img.shields.io/travis/Mermade/widdershins/master.svg) [![Tested on APIs.guru](https://api.apis.guru/badges/tested_on.svg)](https://APIs.guru) [![Tested on Mermade OpenAPIs](https://img.shields.io/badge/Additional%20Specs-419-brightgreen.svg)](https://github.com/mermade/openapi_specifications)
[![Known Vulnerabilities](https://snyk.io/test/npm/widdershins/badge.svg)](https://snyk.io/test/npm/widdershins)

<img src="http://mermade.github.io/widdershins/logo.png" width="247px" height="250px" />

### Widdershins *adverb*:
* In a direction contrary to the sun's course;
* anticlockwise;
* helping you produce static documentation from your OpenApi 3.0 / Swagger 2.0 / AsyncAPI 1.x definition

![Widdershins screenshot](https://github.com/Mermade/oa2s-comparison/blob/master/docs/widdershins.png?raw=true)

### News

As of v2.1.0 Widdershins expands the definition of OpenAPI body parameters / requestBodies (and AsyncAPI headers and payloads) by default. You can restore the old behaviour by using the `--noschema` option.

### To install

* Clone the git repository, or
* `npm install [-g] widdershins`, or
* `yarn global add widdershins`

```
node widdershins [options] {input-spec} [[-o] output markdown]

Options:
  -h, --help            Show help                                      [boolean]
  --version             Show version number                            [boolean]
  -y, --yaml            Load spec in yaml format, default json         [boolean]
  -a, --aggressive      Use alternative dereffing logic                [boolean]
  -c, --code            Turn generic code samples off                  [boolean]
  -d, --discovery       Include schema.org WebAPI discovery data       [boolean]
  -e, --environment     Load config/override options from file          [string]
  -i, --includes        List of files to include, comma separated       [string]
  -l, --lang            Automatically generate list of languages for code
                        samples                                        [boolean]
  -n, --noschema        Do not expand schema definitions               [boolean]
  -o, --outfile         File to write output markdown to                [string]
  -r, --raw             Output raw schemas not example values          [boolean]
  -s, --search          Whether to enable search or not, default true
                                                       [boolean] [default: true]
  -t, --theme           Syntax-highlighter theme to use                 [string]
  -u, --user_templates  directory to load override templates from       [string]
```

or


```javascript
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
options.schema = true; // set false by --noschema
options.discovery = false;
options.includes = [];
optiona.aggressive = false;
converter.convert(swaggerObj,options,function(err,str){
  // str contains the converted markdown
});
```

To only include a subset of the pre-defined language-tabs, or to rename their display-names, you can override the `options.language_tabs`:

```javascript
options.language_tabs = [{ 'http': 'HTTP' }, { 'javascript': 'JavaScript' }, { 'javascript--nodejs': 'Node.JS' }, { 'python': 'Python' }, { 'ruby': 'Ruby' }];
```

If you need to support a version of Slate \<v1.5.0 (or a renderer which also doesn't support display-names for language-tabs, such as `node-slate`, `slate-node` or `whiteboard`), you can use the `--environment` option with the included `whiteboard_env.json` file to simply achieve this.

The `loadedFrom` option is only needed where the OpenApi / Swagger definition does not specify a host, and (as per the OpenApi [specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/2.0.md#fixed-fields)) the API endpoint is deemed to be based on the source URL
the definition was loaded from.

Note that the list of included files is simply passed into the header of the markdown file, they are actually included by Slate or the alternative you use.

To see the list of highlight-js syntax highlighting themes, [click here](https://highlightjs.org/static/demo/).

Schema.org WebAPI discovery data is included if the `discovery` option above is set `true`. See the W3C [WebAPI Discovery Community Group](https://www.w3.org/community/web-api-discovery/) for more information.

## Language tabs

Widdershins supports the `x-code-samples` [vendor-extension](https://github.com/Rebilly/ReDoc/blob/master/docs/redoc-vendor-extensions.md#operation-object-vendor-extensions) to completely customise your documentation. Alternatively, you can edit the default code-samples in the `templates` sub-directory, or override them using the `user_templates` option to specify a directory containing your templates.

Widdershins supports the use of multiple language tabs with the same language (i.e. plain Javascript and Node.Js). To use this support you must be using Slate (or one of its ports compatible with) version 1.5.0 or higher. [Shins](https://github.com/mermade/shins) versions track Slate version numbers.

## Template parameters

Templates are compiled with [doT.js](https://github.com/olado/doT#readme).

Templates have access to a `data` object with a range of properties based on the document context.

If you specify an `options.templateCallback` function, it will be called before and after each template, with three parameters, the template name, the stage, (`'pre'` or `'post'`) and the current `data` object. You can mutate the `data` object in any way you see fit, as long as you `return` it. Content in the `data.append` property will be appended to the current output stream.

* [Swagger 2.0 / OpenAPI 3.0.x template parameters](/templates/openapi3/README.md)
* [AsyncAPI 1.0 template parameters](/templates/asyncapi/README.md)

## Tests

To run a test-suite:

```
node testRunner {path-to-APIs}
```

The test harness currently expects `.yaml` or `.json` files and has been tested against

* [APIs.guru](https://github.com/APIs-guru/openapi-directory)
* [Mermade OpenApi definitions collection](https://github.com/mermade/openapi-definitions)

### Comparison between this and other OpenAPI / Swagger to Slate tools

[Blog posting](https://dev.to/mikeralphson/comparison-of-various-openapiswagger-to-slate-conversion-tools) by the author of Widdershins.

### Acknowledgements

Thanks to [@latgeek](https://github.com/LatGeek) for the logo.

### Widdershins in the wild

Please feel free to add a link to your API documentation here.

* [GOV.UK Content API v1.0.0](https://content-api.publishing.service.gov.uk/reference.html)
