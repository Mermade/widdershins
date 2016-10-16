# widdershins
OpenApi / Swagger definition to [Slate](https://github.com/lord/slate) / 
[Shins](https://github.com/mermade/shins) compatible markdown

<img src="/docs/logo.png" width="247px" height="250px" />

Widdershins supports the `x-code-samples` [vendor-extension](https://github.com/Rebilly/ReDoc/blob/master/docs/redoc-vendor-extensions.md#operation-object-vendor-extensions).

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
options.theme = 'darkula';
var str = converter.convert(swaggerObj,options);
````

To see the list of highlight-js syntax highlighting themes, [click here](https://highlightjs.org/static/demo/)

### Acknowledgements

Thanks to @latgeek for the logo.
