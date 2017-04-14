var HTTPSnippet= require('httpsnippet');

function generate(langs, data){
  var snippet = new HTTPSnippet({
    method: data.methodUpper,
    url: data.url,
    queryString: data.queryParameters.map(function(item){
      return { "name": item.name, "value": item.exampleValues.object }
    }),
    headers: data.allHeaders.map(function(item){
      return { "name": item.name, "value": item.exampleValues.object }
    })
  });

  content = ""
  langs.forEach(function(item){
    var code = snippet.convert(item.lang, item.client);
    if(code){
      content += '```' + item.lang + '\n';
      content += code;
      content += '\n```\n\n';
    }
  })
  return content;
}

module.exports = {
  generate: generate
}
