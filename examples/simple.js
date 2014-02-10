/*!
 * node-opmlparser
 * Copyright(c) 2011-2014 Dan MacTough <danmactough@gmail.com>
 * MIT Licensed
 */

var OpmlParser = require('../')
  , request = require('request');

var opmlparser = new OpmlParser()
  , counter = 0;

var req = request('http://hosting.opml.org/dave/spec/subscriptionList.opml');
req.on('error', done);
req.on('response', function (res) {
  if (res.statusCode != 200) return done(new Error('Bad status code'));
  this.pipe(opmlparser);
})

opmlparser.on('error', done);
opmlparser.once('readable', function () {
  console.log('This OPML is entitled: "%s"', this.meta.title);
});
opmlparser.on('readable', function() {
  var outline;

  while (outline = this.read()) {
    if (outline['#type'] === 'feed') {
      counter++;
      console.log('Got feed: "%s" <%s>', outline.title, outline.xmlurl);
    }
  }
});
opmlparser.on('end', function () {
  console.log('All done. Found %s feeds.', counter);
});

function done (err) {
  if (err) {
    console.log(err, err.stack);
    return process.exit(1);
  }
  process.exit();
}