# Markdown TOC Structure

Structuring your input API document in order to generate the desired Table Of Contents (TOC).

## OpenAPI/Swagger Tags Object

The top level [tags object](https://spec.openapis.org/oas/v3.0.3.html#tag-object) in OpenAPI provides the entries for the TOC. Each [operation](https://spec.openapis.org/oas/v3.0.3.html#operation-object) should link up to a tag, and providing a concise [operationId](https://spec.openapis.org/oas/v3.0.3.html#fixed-fields-7) on each operation provides the second level of ToC entries.

If an `operation` has more than one `tag`, then only the first is used, to prevent duplication of information.

## AsyncAPI 1

In AsyncAPI v1 `tags` and `topics` are used in a similar way to that of OpenAPI in order to generate the TOC.

## AsyncAPI 2

* TODO

## Semoasa

In Semoasa v1, the `namespace` and `extension` property keys are used to generate the TOC entries.

