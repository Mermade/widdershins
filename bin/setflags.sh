#!/bin/sh
if [ "$TRAVIS_NODE_VERSION" -eq "4" ] ; then 
  export nflags="--harmony"
fi
echo flags: $nflags
