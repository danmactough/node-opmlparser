/*!
 * node-opmlparser
 * Copyright(c) 2014 Dan MacTough <danmactough@gmail.com>
 * MIT Licensed
 */

var OpmlParser = require('../');

var opmlparser = new OpmlParser()
  , index = {};

var xml = [  '<?xml version="1.0" encoding="ISO-8859-1"?>',
              '<opml version="1.1">',
              '<head>',
              '<title>I\'m a tree</title>',
              '</head>',
              '<body>',
              '<outline text="trunk">',
                '<outline text="limb">',
                  '<outline text="leaf"/>',
                  '<outline text="leaf"/>',
                '</outline>',
                '<outline text="limb">',
                  '<outline text="leaf"/>',
                  '<outline text="leaf"/>',
                  '<outline text="leaf"/>',
                '</outline>',
              '</outline>',
              '<outline text="stump"/>',
              '</body>',
              '</opml>'].join('\n');

opmlparser.on('error', done);
opmlparser.once('readable', function () {
  console.log('This OPML is entitled: "%s"', this.meta.title);
});
opmlparser.on('readable', function() {
  var outline;

  while (outline = this.read()) {
    index[outline['#id']] = outline;
  }
});
opmlparser.on('end', function () {
  console.log('Here\'s my hierarchy.');

  var stack = Object.keys(index).reduce(function (stack, id) {
    var outline = index[id]
      , i
      , children;
    if (stack[0]['#id'] === outline['#parentid']) {
      stack[0].children || (stack[0].children = {});
      stack[0].children[id] = outline;
    }
    else if (stack[0].children && outline['#parentid'] in stack[0].children) {
      stack.unshift(stack[0].children[outline['#parentid']]);
      stack[0].children || (stack[0].children = {});
      stack[0].children[id] = outline;
    }
    else {
      // unwind the stack as much as needed
      for (i = stack.length - 1; i >= 0; i--) {
        children = stack.shift();
        stack[0].children[children['#id']] = children;
        if (stack[0]['#id'] === outline['#parentid']) {
          stack[0].children[id] = outline;
          break;
        }
      }
    }
    return stack;
  }, [ { 'text': 'root', '#id': 0, children: {} } ]);

  console.log(inspect(stack[0]));
  console.log('All done.');
});

opmlparser.end(xml);

function done (err) {
  if (err) {
    console.log(err, err.stack);
    return process.exit(1);
  }
  process.exit();
}

function inspect (obj) {
  return require('util').inspect(obj, null, 10, true);
}