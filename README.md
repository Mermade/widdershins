# widdershins
OpenApi / Swagger definition to [Slate](https://github.com/lord/slate) / 
[Shins](https://github.com/mermade/shins) compatible markdown

````
widdershins [options] {input-spec} [output markdown]

Options:
  -h, --help  Show help                                                [boolean]
  --version   Show version number                                      [boolean]
  -y, --yaml  Load spec in yaml format, default json                   [boolean]
````

or


````javascript
var converter = require('widdershins');
var str = converter.convert(swaggerObj);
````
