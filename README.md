[![Build Status](https://secure.travis-ci.org/danmactough/node-opmlparser.png?branch=refactor)](https://travis-ci.org/danmactough/node-opmlparser)
#  Opmlparser - OPML parsing in Node.js

This module adds methods for OPML parsing in node.js using Isaac Schlueter's [sax](https://github.com/isaacs/sax-js) parser.

## Requirements

- [sax](https://github.com/isaacs/sax-js)
- [request](https://github.com/mikeal/request)

## Installation

    npm install opmlparser

## Changes since v0.4.x

- New preferred API -- just `.pipe()` in a [readable stream](http://nodejs.org/api/stream.html#stream_readable_stream).
- The `end` event passes no arguments; use `complete` if you want `meta`, `feeds`, and `outline`. `end` will be emitted even when there's been a fatal error.
- All properties are **only lowercase**; no camelCase
- You no longer create your own Opmlparser instance; just use the methods directly (while they last; they'll likely be gone in the next minor version)

```js

var OpmlParser = require('opmlparser')
  , request = require('request');

request('http://someopmlurl.opml')
  .pipe(new OpmlParser([options]))
  .on('error', function(error) {
    // always handle errors
  })
  .on('meta', function (meta) {
    // do something
  })
  .on('feed', function (feed) {
    // do something else
  });
  .on('outline', function (outline) {
    // do something else
  });
  .on('end', function () {
   // do the next thing
  });
```

### options

- `addmeta` - Set to `false` to override Opmlparser's default behavior, which
  is to add the OPML's `meta` information to each `feed`.

- `opmlurl` - The url (string) of the OPML. Opmlparser is very good at
  resolving relative urls in OPML files. But OPML files could use relative urls without
  declaring the `xml:base` attribute any place in the file. This is perfectly
  valid, but we don't know know the file's url before we start parsing the file
  and trying to resolve those relative urls. If we discover the file's url, we
  will go back and resolve the relative urls we've already seen, but this takes
  a little time (not much). If you want to be sure we never have to re-resolve
  relative urls (or if Opmlparser is failing to properly resolve relative urls),
  you should set the `opmlurl` option. Otherwise, feel free to ignore this option.

## libxml-like Helper Methods (deprecated)

### parser.parseString(string, [options], [callback])

- `string` - the contents of the file

### parser.parseFile(filename, [options], [callback])

- `filename` - a local filename or remote url

### parser.parseUrl(url, [options], [callback])

The first argument can be either a url or a `request` options object. The only
required option is uri, all others are optional. See
[request](https://github.com/mikeal/request#requestoptions-callback) for details
about what that `request` options object might look like.

- `url` - fully qualified uri or a parsed url object from url.parse()

### parser.parseStream(readableStream, [options], [callback])

- `readableStream` - a [Readable Stream](http://nodejs.org/api/stream.html#stream_readable_stream)

## Examples

See the [examples](examples/) directory.

Deprecated libxml-style examples are [here](examples-old.md).

## What is the parsed output produced by opmlparser?

Opmlparser parses each OPML file into a `meta` portion, a `feeds` portion, and an
`outline` portion.

The `meta` will be the information in the OPML's `<head>` element, plus some
additional metadata, such as OPML version, any namespaces defined, etc.

If the OPML is a subscription list, the `feeds` will contain an array of objects
representing each feed. If the OPML is not a subscription list, `feeds` will be
`null`. When opmlparser is used as an event emitter, each `feed` is
emitted as a 'feed' event.

The `outline` will simply translate the OPML's `<body>` from XML to a Javascript
object (i.e., JSON), preserving the tree structure, if any.

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

### List of feed properties

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

## License

(The MIT License)

Copyright (c) 2011 Dan MacTough <danmactough@gmail.com>

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
