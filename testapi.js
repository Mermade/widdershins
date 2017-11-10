const yaml = require('js-yaml');
const fs = require('fs');

const deref = require('reftools/lib/dereference.js').dereference;
const clone = require('reftools/lib/clone.js').clone;
const ccirc = require('reftools/lib/clone.js').circularClone;

const s = fs.readFileSync('../openapi-directory/APIs/bbci.co.uk/1.0/swagger.yaml','utf8');
let api = yaml.safeLoad(s,{json:true});

fs.writeFileSync('./bbc1.yaml',yaml.safeDump(api),'utf8');

let orig = clone(api);

api.paths = deref(api.paths,api,{$ref:'$oldref',cloneFunc:ccirc,verbose:true});
console.log('writing...');
fs.writeFileSync('./bbc2.yaml',yaml.safeDump(api),'utf8');
console.log('finishing...');

api = clone(orig);
api = deref(api,api,{$ref:'$oldref',cloneFunc:ccirc,verbose:true});
console.log('writing...');
fs.writeFileSync('./bbc3.yaml',yaml.safeDump(api),'utf8');
console.log('finishing...');
