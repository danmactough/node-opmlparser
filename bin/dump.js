#!/usr/bin/env node
/*
 * Parse an outline and dump the result to the console
 *
 * Usage: curl <outline url> | bin/dump.js
 *        cat <outline file> | bin/dump.js
 *
 */
var util = require('util')
  , OpmlParser = require('../');

process.stdin.pipe(new OpmlParser())
  .on('error', console.error)
  .on('readable', function() {
    var stream = this, item;
    while (item = stream.read()) {
      console.log(util.inspect(item, null, 10, true));
    }
  });
