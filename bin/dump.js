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
    var stream = this, outline;
    while (outline = stream.read()) {
      console.log(util.inspect(outline, null, 10, true));
    }
  })
  .on('end', function () {
    console.log(util.inspect(this.meta, null, 10, true));
  });
