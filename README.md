# widdershins
OpenApi / Swagger definition to [Slate](https://github.com/lord/slate) / 
[Shins](https://github.com/mermade/shins) compatible markdown

Widdershins supports the `x-code-samples` [vendor-extension](https://github.com/Rebilly/ReDoc/blob/master/docs/redoc-vendor-extensions.md#operation-object-vendor-extensions).

````
widdershins [options] {input-spec} [output markdown]

Options:
  -h, --help  Show help                                                [boolean]
  --version   Show version number                                      [boolean]
  -y, --yaml  Load spec in yaml format, default json                   [boolean]
  -c, --code  Turn generic code samples off                            [boolean]
  -l, --lang  Automatically generate list of languages for code samples[boolean]
````

or


````javascript
var converter = require('widdershins');
var options = {};
var str = converter.convert(swaggerObj,options);
````
