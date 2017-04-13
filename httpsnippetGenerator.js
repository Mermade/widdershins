var HTTPSnippet= require('httpsnippet');

function generate(langs, data){
  var snippet = new HTTPSnippet({
    method: data.methodUpper,
    url: 'http' + data.url,
    queryString: data.queryParameters.map(function(item){
      return { "name": item.name, "value": item.exampleValues.object }
    }),
    headers: data.allHeaders.map(function(item){
      return { "name": item.name, "value": item.exampleValues.object }
    })
  });

  content = ""
  var keyLangs = langs.map(function(lang){ return [Object.keys(lang)]});
  keyLangs.forEach(function(lang){
    var code = snippet.convert(lang);
    if(code){
      content += '```' + lang + '\n';
      content += code;
      content += '\n```\n\n';
    }
  })
  return content;
}

module.exports = {
  generate: generate
}
