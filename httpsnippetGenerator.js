var HTTPSnippet= require('httpsnippet');
var _ = require('underscore');
function generate(langs, data){

  var snippet = new HTTPSnippet({
    method: data.methodUpper,
    url: 'http' + data.url,
    queryString:  _.map(data.queryParameters, function(item){
      return { "name": item.name, "value": item.exampleValues.object }
    }),
    headers: _.map(data.allHeaders, function(item){
      return { "name": item.name, "value": item.exampleValues.object }
    })
  });

  content = ""
  var keyLangs = _.flatten(_.map(langs, function(lang){ return _.keys(lang)}));
  _.each(keyLangs, function(lang){
    content += '```' + lang + '\n';
    content += snippet.convert(lang);
    content += '\n```\n\n';
  })
  return content;
}

module.exports = {
  generate: generate
}
