# Converting an OpenAPI/Swagger file to Markdown with Widdershins

You can use Widdershins from the command-line interface or from a JavaScript program to convert an OpenAPI/Swagger file to Markdown.
The methods produce the same output, but the JavaScript method allows more customization because you can manipulate the options, input, and output in the JavaScript program.

## Prerequisites

These prerequisites are required for either method:

- Install NodeJS and Node Package Manager (NPM).
See [nodejs.org](https://nodejs.org/).
- Install Widdershins and its dependencies.
The easiest way is to use NPM with one of these methods:
  - If you're working in a JavaScript project with NodeJS and NPM, you can install Widdershins and add it to your project by running this command in the terminal from the root of your project:
  ```shell
  npm install --save widdershins
  ```
  - If you're not using an NPM project or are using the command line, you can use NPM to install Widdershins globally so you can use it with the command line from any folder:
  ```shell
  npm install -g widdershins
  ```

## Converting files on the command line

The simplest way to convert files with Widdershins is to use the command line.

1. Get an OpenAPI 3.0 or Swagger 2.0 file.
To test the process, you can use the pet store sample here: https://petstore.swagger.io/v2/swagger.json
The file must parse as a valid OpenAPI or Swagger file.
1. Assemble the options that you want to use to convert the file.
These options are listed in the [README.md](https://github.com/Mermade/widdershins#options) file.

  Note that some of these options are useful only if you intend to take the Markdown output from Widdershins and convert it to HTML with [Shins](https://github.com/Mermade/shins).
  Other options are not usable from the command line.

  For example, the `language_tabs` option specifies a list of one or more languages to generate examples in, each with an ID and display name.
  You can generate examples in Ruby and Python with the command-line option `--language_tabs 'ruby:Ruby' 'python:Python'`.
1. Optional: Put the options in an environment file for easier reuse.
Environment files contain the options for the conversion in JSON format.
For environment files, use the JavaScript parameter name from the [README.md](https://github.com/Mermade/widdershins#options) file, not the CLI parameter name.
For example:
```json
{
  "language_tabs": [{ "python": "Python" }, { "ruby": "Ruby" }]
}
```
1. Convert the file with the `widdershins` command, specify the name of the OpenAPI or Swagger file, and specify the name of the output file with the `-o` option.
Include the options in the command or specify the name of the environment file with the `--environment` option, as in this example:
```shell
widdershins --environment env.json swagger.json -o myOutput.md
```

## Converting files with JavaScript

Using a JavaScript program to convert OpenAPI/Swagger files to Markdown provides greater control over the process.
The easiest way to use Widdershins with JavaScript is to set up an NPM project and install Widdershins as a dependency:

1. If you don't already have an NPM project, run `npm init` from the folder in which you want to create the program.
NPM walks you through the process of setting up an NPM project.
Most of the NPM settings are not relevant to Widdershins; the important part of the process is that it sets up a project that can install and manage NPM packages such as Widdershins so you can use those packages in your programs.
1. From the root folder of your project (the folder that contains the `package.json` file), add Widdershins as a dependency by running this command:
```shell
npm install --save widdershins
```
1. Create a JavaScript program with the following general steps.
You can name the file anything you want.
1. Import Widdershins so you can use it in the program:
```javascript
const widdershins = require('widdershins');
```
1. Set up your options in an `options` object.
Use the JavaScript parameter name from the [README.md](https://github.com/Mermade/widdershins#options) file, not the CLI parameter name.
For example, these options generate code samples in Python and Ruby:
```javascript
const options = {
  language_tabs: [{ python: "Python" }, { ruby: "Ruby" }]
};
```
1. Import and parse the OpenAPI or Swagger file.
This example uses the NodeJS FileSystem and JSON packages:
```javascript
const fs = require('fs');
const fileData = fs.readFileSync('swagger.json', 'utf8');
const swaggerFile = JSON.parse(fileData);
```
1. Use Widdershins to convert the file.
Widdershins returns the converted Markdown in a callback function:
```javascript
widdershins.convert(swaggerFile, options, function(err, markdownOutput) {
  // markdownOutput contains the converted markdown
});
```
1. Within the callback function, write the Markdown to a file:
```javascript
widdershins.convert(swaggerFile, options, function(err, markdownOutput) {
  // markdownOutput contains the converted markdown
  fs.writeFileSync('myOutput.md', markdownOutput, 'utf8');
});
```
1. Run the JavaScript program:
```shell
node convertMarkdown.js
```

The complete JavaScript program looks like this:

```javascript
const widdershins = require('widdershins');
const fs = require('fs');

const options = {
  language_tabs: [{ python: "Python" }, { ruby: "Ruby" }]
};

const fileData = fs.readFileSync('swagger.json', 'utf8');
const swaggerFile = JSON.parse(fileData);

widdershins.convert(swaggerFile, options, function(err, markdownOutput) {
  // markdownOutput contains the converted markdown
  fs.writeFileSync('myOutput.md', markdownOutput, 'utf8');
});
```
