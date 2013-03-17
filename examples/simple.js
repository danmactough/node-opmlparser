/*!
 * node-opmlparser
 * Copyright(c) 2011 Dan MacTough <danmactough@gmail.com>
 * MIT Licensed
 */

var OpmlParser = require('../')
  , parser

parser = new OpmlParser();

parser.on('meta', function (meta){
  console.log('This OPML is entitled: "%s"', meta.title);
});
parser.on('feed', function (feed){
  console.log('Got feed: "%s" <%s>', feed.title, feed.xmlurl);
});

parser.parseFile('http://hosting.opml.org/dave/spec/subscriptionList.opml');
