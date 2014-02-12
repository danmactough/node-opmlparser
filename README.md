[![Build Status](https://secure.travis-ci.org/danmactough/node-opmlparser.png?branch=master)](https://travis-ci.org/danmactough/node-opmlparser)
#  Opmlparser - OPML parsing in Node.js

This module adds methods for OPML parsing in node.js using Isaac Schlueter's
[sax](https://github.com/isaacs/sax-js) parser.

## Requirements

- [sax](https://github.com/isaacs/sax-js)
- [readable-stream](https://github.com/isaacs/readable-stream) (only if using Node <= v0.8.x)

## Installation

    npm install opmlparser

## Changes since v0.5.x

- The libxml-like helper methods have been removed. There is now just one input
interface: the stream interface.

- The `addmeta` option was removed, as it is unnecessary and only adds bloat.

- Events:

    - `304`, `response` - removed, as Opmlparser no longer fetches urls
    - `meta`, `outline`, `feed`, `complete` - removed; use the stream interface
    - `data` - all readable streams will emit a `data` event, but this puts the
      stream into "old" v0.8-style push streams
    - `end` - stream behavior dictates that the `end` event will never fire if
      you don't read any data from the stream; you can kick the Opmlparser stream
      to work like an "old" v0.8-style push stream (and get the old `end` event
      behavior) by calling `.resume()`.

- `SAXErrors` are emitted as `error` events. By default, they are automatically
resumed. Pass `{ resume_saxerror: false }` as an option if you want to manually
handle `SAXErrors` (abort parsing, perhaps).

```js

var OpmlParser = require('opmlparser')
  , request = require('request');

var req = request('http://someopmlurl.opml');
var opmlparser = new OpmlParser([options]);

req.on('error', function (error) {
  // handle any request errors
});
req.on('response', function (res) {
  var stream = this;

  if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));

  stream.pipe(opmlparser);
});


opmlparser.on('error', function(error) {
  // always handle errors
});
opmlparser.on('readable', function() {
  var stream = this
    , meta = this.meta // **NOTE** the "meta" is always available in the context of the opmlparser instance
    , outline;

  while (outline = stream.read()) {
    console.log(outline);
  }
});
```

### options

- `opmlurl` - The url (string) of the OPML. Opmlparser is very good at
resolving relative urls in OPML files. But OPML files could use relative urls
without declaring the `xml:base` attribute any place in the file. This is
perfectly valid, but we don't know know the file's url before we start parsing
the file and trying to resolve those relative urls. If we discover the file's
url, we will go back and resolve the relative urls we've already seen, but this
takes a little time (not much). If you want to be sure we never have to re-
resolve relative urls (or if Opmlparser is failing to properly resolve relative
urls), you should set the `opmlurl` option. Otherwise, feel free to ignore this
option.

- `resume_saxerror` - Set to `false` to override Opmlparser's default behavior,
which is to emit any `SAXError` on `error` and then automatically resume
parsing. In my experience, `SAXErrors` are not usually fatal, so this is usually
helpful behavior. If you want total control over handling these errors and
optionally aborting parsing the OPML, use this option.

## Examples

See the [`examples`](examples/) directory.

## API

### Transform Stream

Opmlparser is a [transform stream](http://nodejs.org/api/stream.html#stream_class_stream_transform) operating in "object mode": XML in -> Javascript objects out.
Each readable chunk is an object representing an `<outline>` element in the OPML.

## What is the parsed output produced by opmlparser?

Opmlparser parses each OPML file into readable `outline` chunks, as well as a
`meta` object.

The `meta` will be the information in the OPML's `<head>` element, plus some
additional metadata, such as OPML version, any namespaces defined, etc.

Each `outline` chunk will simply translate an `<outline>` element in the OPML's
`<body>` from XML to a Javascript object. Each chunk is assigned a
simple counter-based id when it is parsed and references its immediate ancestor's
id, which will allow you to recreate the tree if you want.

### List of meta propreties

No validation is performed. Each of the meta properties will be defined, but any
of them may be `null`.

* title
* datecreated
* datemodified
* ownername
* ownerid
* docs
* expansionstate
* vertscrollstate
* windowtop
* windowleft
* windowbottom
* windowright

### List of outline properties

No validation is performed. Any or all of the following properties may be
absent, and other arbitrary (and invalid) properties may be present.

* title
* text
* xmlurl
* htmlurl
* description
* type
* language
* version

See the [OPML Spec](http://dev.opml.org/spec2.html) for more info about what to
expect to see in various kinds of OPML files.

In addition, Opmlparser adds the following properties:

* #id - this outline element's id
* #parentid - this id of this outline element's immediate ancestor
* #type (optional) - this outline element contains a feed

## License

(The MIT License)

Copyright (c) 2011-2014 Dan MacTough <danmactough@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
'Software'), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
