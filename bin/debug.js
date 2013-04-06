#!/usr/bin/env node
var path = require('path')
  , OpmlParser = require('../../opmlparser')
  , usage
  , flag = null
  , uri
  ;

usage = "Usage: node " + path.basename(process.argv[1]) + " [-m|-p] filename|url\n"
usage += "  -m Display only opml meta\n";
usage += "  -p Display only feeds\n";

if (process.argv.length < 3 || process.argv.length > 4) {
  console.error(usage);
  process.exit(1);
}
if (process.argv.length === 4) {
  flag = process.argv[2];
  uri = process.argv[3];
} else {
  uri = process.argv[2];
}

function _parse(uri, cb) {
  var fp = new OpmlParser();
  if (/^https?:/i.test(uri)) fp.parseUrl(uri, cb);
  else fp.parseFile(uri, cb);
}

_parse(uri, function(err, meta, feeds, outline){
  if (err) {
    console.error(err);
    process.nextTick(function(){
      process.exit(2);
    });
  } else {
    if (flag == '-m') {
      console.log(meta);
    } else if (flag == '-p') {
      console.log(feeds);
    } else if (flag) {
      console.error(usage);
      process.exit(1);
    } else {
      console.log(meta);
      console.log(feeds);
      console.log(outline);
    }
    process.nextTick(function(){
      process.exit(0);
    });
  }
});
