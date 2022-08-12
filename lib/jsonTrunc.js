'use strict'

// https://github.com/davideancona/JSONstringify
// License: MIT

const default_depth = 2 // default truncation depth
const object_trunc = '[Object]' // string for truncated objects
const getter_trunc = '[Getter]' // string for getters
const cycle_trunc = '[Circular]' // string for truncated cycles

// handler for bookkeeping of visited indexes of arrays
let array_handler={
    not_in_visited:(k,next) => k>=next,  // all indexes >= next have not been visited yet
    add_visited:node => {node.visited++}, // assuming the standard visiting order for array elements, k===node.visited holds (hence the visited index k is useless as parameter here)
    init_visited:() => 0 // first index to visit is 0
}

// handler for bookkeeping of visited properties of non array objects
let object_handler={
    not_in_visited:(k,prop_set) => !prop_set.includes(k), // all properties not in prop_set have not been visited yet
    add_visited:(node,k) => {node.visited.push(k)}, // push property k on the array of visited properties of node.value
    init_visited:() => [] // visited properties are initially the empty array
}

function shallow_copy(v){
    if (Array.isArray(v))
    return v.slice()
    let copy={} // prepares a shallow copy of v where getters are not evaluated
    for (const prop of Object.getOwnPropertyNames(v))
    {
    let desc=Object.getOwnPropertyDescriptor(v,prop)
    Object.defineProperty(copy,prop,desc.get?{value:getter_trunc,enumerable:true}:desc)
    }
    return copy
}

/* options:
   depth: truncation depth (0 is the root), defaults to 2
   visit_cycles: cycles are visited if set to true, defaults to false
*/
function stringifyTrunc(value,replacer,indent,options){

    options=options||{depth:default_depth}

    // depth at which truncation occurs
    const depth=typeof options.depth==='number'&&options.depth>=0?Math.floor(options.depth):default_depth
    const exit_cycles=!(options.visit_cycles||false)
    /*
       a is an initially empty stack of visited nodes represented by pairs {value:node,visited:visited properties/indexes}
       value: the visited node (either an array, or a non array object)
       visited: properties/indexes pointing to children visited so far
       if value is an array, then visited is the index of the next element of value that has to be visited (hence all elements in the inclusive range 0..visited-1 have been already visited
       if value is a non array object, then visited is the array of properties pointing to children visited so far
    */
    const a=[]

    function replace(k,v){

    function is_child(c,p,k){ // c: child value to be inserted with associated value k; p: potential parent; handler h globally defined in replace
        return p.value[k]===c && h.not_in_visited(k,p.visited)
    }

    function try_push(v){ // handler h globally defined in replace; array a and int value depth globally defined in stringifyTrunc
        if (a.length>=depth)
        return object_trunc
        if (exit_cycles&&a.some(el => el.value===v))
        return cycle_trunc
        a.push({value:v,visited:h.init_visited()}) // push the node, no keys inspected so far
        return shallow_copy(v)
    }

    function insert(k,v){ // handler h and array a globally defined in replace and stringifyTrunc, respectively; return false iff node has not been inserted because of truncation
        while (a.length>0) {
        let top=a[a.length-1]
        if (is_child(v,top,k)) {
            h.add_visited(top,k) // update visited children
            return try_push(v) // try pushing the child node
        }
        a.pop() // the parent is not on the top
        }
        return try_push(v) // try pushing the child node on the empty stack, fails only if depth===0
    }
    // start replace
    if (v===null || typeof v!=='object')
        return v
    let h=typeof k==='number'?array_handler:object_handler
    return insert(k,v) // be careful: insert can pop stuff and decrease the length of a!
    }
    // start stringifyTrunc
    return JSON.stringify(value,replace,indent)
}

module.exports=stringifyTrunc

