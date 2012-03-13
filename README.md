#  Opmlparser - OPML parsing in Node.js 
      
This module adds methods for OPML parsing in node.js using Isaac Schlueter's [sax](https://github.com/isaacs/sax-js) parser.

## Requirements

- [sax](https://github.com/isaacs/sax-js)
- [request](https://github.com/mikeal/request)

## Installation

    npm install opmlparser

## Example

```javascript
    var OpmlParser = require('opmlparser')
      , parser = new OpmlParser();
      // The following modules are used in the examples below
      , fs = require('fs')
      , request = require('request')
      ;
```
### Use as an EventEmitter

```javascript

    parser.on('feed', function(feed){
        console.log('Got feed: %s', JSON.stringify(feed));
    });

    // You can give a local file path to parseFile()
    parser.parseFile('./opml');

    // For libxml compatibility, you can also give a URL to parseFile()
    parser.parseFile('http://hosting.opml.org/dave/spec/subscriptionList.opml');

    // Or, you can give that URL to parseUrl()
    parser.parseUrl('http://hosting.opml.org/dave/spec/subscriptionList.opml');

    // But you should probably be using conditional GETs and passing the results to
    // parseString() or piping it right into the stream, if possible

    var reqObj = {'uri': 'http://hosting.opml.org/dave/spec/subscriptionList.opml',
                  'If-Modified-Since' : <your cached 'lastModified' value>,
                  'If-None-Match' : <your cached 'etag' value>};

    // parseString()
    request(reqObj, function (err, response, body){
      parser.parseString(body);
    });

    // Stream piping -- very sexy
    request(reqObj).pipe(parser.stream);

    // Using the stream interface with a file (or string)
    // A good alternative to parseFile() or parseString() when you have a large local file
    parser.parseStream(fs.createReadStream('./opml'));
    // Or
    fs.createReadStream('./opml').pipe(parser.stream);
```
### Use with a callback

When the OPML is finished being parsed, if you provide a callback, it gets
called with four parameters: error, meta, feeds, and outline.

```javascript

    function myCallback (error, meta, feeds, outline){
      if (error) console.error(error);
      else {
        console.log('OPML info');
        console.log('%s - %s - %s', meta.title, meta.dateCreated, meta.ownerName);
        console.log('Feeds');
        feeds.forEach(function (feed){
          console.log('%s - %s (%s)', feed.title, feed.htmlUrl, feed.xmlUrl);
        });
      }
    }

    parser.parseFile('./opml', myCallback);

    // To use the stream interface with a callback, you *MUST* use parseStream(), not piping
    parser.parseStream(fs.createReadStream('./opml'), myCallback);
```
## What is the parsed output produced by opmlparser?

Opmlparser parses each OPML file into a `meta` portion, a `feeds` portion, and an
`outline` portion.

The `meta` will be the information in the OPML's `<head>` element, plus some
additional metadata, such as OPML version, any namespaces defined, etc.

If the OPML is a subscription list, the `feeds` will contain an array of objects
representing each feed. If the OPML is not a subscription list, `feeds` will be
an empty array. When opmlparser is used as an event emitter, each `feed` is
emitted as a 'feed' event.

The `outline` will simply translate the OPML's `<body>` from XML to a Javascript
object (i.e., JSON), preserving the tree structure, if any.

### List of meta propreties

No validation is performed. Each of the meta properties will be defined, but any
of them may be `null`.

* title
* dateCreated
* dateModified
* ownerName
* ownerId
* docs
* expansionState
* vertScrollState
* windowTop
* windowLeft
* windowBottom
* windowRight

### List of feed properties

No validation is performed. Any or all of the following properties may be
absent, and other arbitrary (and invalid) properties may be present.

* title
* text
* xmlUrl
* htmlUrl
* description
* type
* language
* version

See the [OPML Spec](http://dev.opml.org/spec2.html) for more info about what to
expect to see in various kinds of OPML files.

## License 

(The MIT License)

Copyright (c) 2011 Dan MacTough &lt;danmactough@gmail.com&gt;

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
