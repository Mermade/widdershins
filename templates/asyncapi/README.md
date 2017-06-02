## AsyncAPI 1.0 template parameters

### Code templates

* `topic` - the current topic
* `message` - the current message
* `resource` - the current tag/topic object
* `tags[]` - the full list of tags applying to the message
* `payload` - containing `.obj`, `.str` and `.json` properties
* `header` - containing `.obj`, `.str` and `.json` properties

### Payload template

As above for code templates

### Header templates

As above for code templates

### Common to all templates

* `api` - the top-level AsynAPI document
* `header` - the front-matter of the Slate/Shins markdown document
* `servers` - the (computed) servers of the API
* `baseTopic` - the baseTopic of the API
* `contactName` - the (possibly default) contact name for the API
