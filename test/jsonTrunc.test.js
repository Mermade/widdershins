'use strict'

const jsonTrunc = require('../lib/jsonTrunc.js')

function stringifyTrunc(o,options) {
  return jsonTrunc(o,null,0,options);
}

let o={get getter(){return 42}}
o.p=o.q=o.r=o
o.x=42

console.assert(stringifyTrunc(o,{depth:0})==='"[Object]"')
console.assert(stringifyTrunc(o,{depth:0,visit_cycles:true})==='"[Object]"')
console.assert(stringifyTrunc(o,{depth:1})==='{"getter":"[Getter]","r":"[Object]","q":"[Object]","p":"[Object]","x":42}')
console.assert(stringifyTrunc(o,{depth:1,visit_cycles:true})==='{"getter":"[Getter]","r":"[Object]","q":"[Object]","p":"[Object]","x":42}')
console.assert(stringifyTrunc(o)==='{"getter":"[Getter]","r":"[Circular]","q":"[Circular]","p":"[Circular]","x":42}')
console.assert(stringifyTrunc(o,{visit_cycles:true})==='{"getter":"[Getter]","r":{"getter":"[Getter]","r":"[Object]","q":"[Object]","p":"[Object]","x":42},"q":{"getter":"[Getter]","r":"[Object]","q":"[Object]","p":"[Object]","x":42},"p":{"getter":"[Getter]","r":"[Object]","q":"[Object]","p":"[Object]","x":42},"x":42}')

let s={x:{y:{z:1},z:1}}
o={p:s,q:s,r:s}

console.assert(stringifyTrunc(o,{depth:0})==='"[Object]"')
console.assert(stringifyTrunc(o,{depth:1})==='{"p":"[Object]","q":"[Object]","r":"[Object]"}')
console.assert(stringifyTrunc(o)==='{"p":{"x":"[Object]"},"q":{"x":"[Object]"},"r":{"x":"[Object]"}}')
console.assert(stringifyTrunc(o,{depth:3})==='{"p":{"x":{"y":"[Object]","z":1}},"q":{"x":{"y":"[Object]","z":1}},"r":{"x":{"y":"[Object]","z":1}}}')
console.assert(stringifyTrunc(o,{depth:4})==='{"p":{"x":{"y":{"z":1},"z":1}},"q":{"x":{"y":{"z":1},"z":1}},"r":{"x":{"y":{"z":1},"z":1}}}')
console.assert(stringifyTrunc(o,{depth:5})==='{"p":{"x":{"y":{"z":1},"z":1}},"q":{"x":{"y":{"z":1},"z":1}},"r":{"x":{"y":{"z":1},"z":1}}}')

o=[]
o[0]=o

console.assert(stringifyTrunc(o)==='["[Circular]"]')
o.length=4
console.assert(stringifyTrunc(o)==='["[Circular]",null,null,null]')
o[6]=1
console.assert(stringifyTrunc(o)==='["[Circular]",null,null,null,null,null,1]')
o.prop=1
console.assert(stringifyTrunc(o)==='["[Circular]",null,null,null,null,null,1]')

Object.defineProperty(o,'getter',{get:() => 42,enumerable:true})
console.assert(stringifyTrunc(o)==='["[Circular]",null,null,null,null,null,1]')

console.assert(stringifyTrunc([1,2,3,4,5])==='[1,2,3,4,5]')
console.assert(stringifyTrunc([1,[2],[[3]],[[[4]]],[[[[5]]]]])==='[1,[2],["[Object]"],["[Object]"],["[Object]"]]')
console.assert(stringifyTrunc([1,[2],[[3]],[[[4]]],[[[[5]]]]],{depth:3})==='[1,[2],[[3]],[["[Object]"]],[["[Object]"]]]')
console.assert(stringifyTrunc([1,[2],[[3]],[[[4]]],[[[[5]]]]],{depth:4})==='[1,[2],[[3]],[[[4]]],[[["[Object]"]]]]')
console.assert(stringifyTrunc([1,[2],[[3]],[[[4]]],[[[[5]]]]],{depth:5})==='[1,[2],[[3]],[[[4]]],[[[[5]]]]]')

let inner=Symbol('Inner')
o={get val(){return this[inner]}, set val(v){if (v<0) throw new Error("Illegal argument"); this[inner]=v}}
o[inner]=42

console.assert(stringifyTrunc(o)==='{"val":"[Getter]"}')

let a=[]
a[0]={p:a}
a[1]={p:a,q:1}
a[2]={p:a,q:{p:a,q:1}}
console.assert(stringifyTrunc(a)==='[{"p":"[Object]"},{"p":"[Object]","q":1},{"p":"[Object]","q":"[Object]"}]')
console.assert(stringifyTrunc(a,{depth:3})==='[{"p":"[Circular]"},{"p":"[Circular]","q":1},{"p":"[Circular]","q":{"p":"[Object]","q":1}}]')
console.assert(stringifyTrunc(a,{depth:3,visit_cycles:true})==='[{"p":["[Object]","[Object]","[Object]"]},{"p":["[Object]","[Object]","[Object]"],"q":1},{"p":["[Object]","[Object]","[Object]"],"q":{"p":"[Object]","q":1}}]')
console.assert(stringifyTrunc(a,{depth:4,visit_cycles:true})==='[{"p":[{"p":"[Object]"},{"p":"[Object]","q":1},{"p":"[Object]","q":"[Object]"}]},{"p":[{"p":"[Object]"},{"p":"[Object]","q":1},{"p":"[Object]","q":"[Object]"}],"q":1},{"p":[{"p":"[Object]"},{"p":"[Object]","q":1},{"p":"[Object]","q":"[Object]"}],"q":{"p":["[Object]","[Object]","[Object]"],"q":1}}]')

a=[{a:1,b:[1,{a:1,b:2}]},{a:[1,{a:1,b:2}],b:1}]
console.assert(stringifyTrunc(a)==='[{"a":1,"b":"[Object]"},{"a":"[Object]","b":1}]')
console.assert(stringifyTrunc(a,{depth:3})==='[{"a":1,"b":[1,"[Object]"]},{"a":[1,"[Object]"],"b":1}]')
console.assert(stringifyTrunc(a,{depth:4})==='[{"a":1,"b":[1,{"a":1,"b":2}]},{"a":[1,{"a":1,"b":2}],"b":1}]')

console.assert(stringifyTrunc({a:{b:null,c:undefined},b:null,c:undefined})==='{"a":{"b":null},"b":null}')
