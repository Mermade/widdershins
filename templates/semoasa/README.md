## Semoasa 0.1.0 template parameters

### 'main' templates

* `api` - the top-level Semoasa document
* `header` - the front-matter of the Slate/Shins markdown document
* `options` - the options passed to the renderer, includes defaults
* `templates` - the doT templates object
* `oas2_descs` - a map of OASv2 objects and descriptions
* `oas3_descs` - a map of OASv3 objects and descriptions
* `utils` - an object containing utility functions
  * `yaml` - `js-yaml` instance
  * `schemaToArray` - converts a schema object to a flat list of properties
  * `getSample` - returns an example based on a schema object
  * `linkCase` - helper function which returns camelCased object names

