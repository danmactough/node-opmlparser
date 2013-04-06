## libxml-style Examples (deprecated)

```javascript
    var parser = require('opmlparser');
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
        console.log('%s - %s - %s', meta.title, meta.datecreated, meta.ownername);
        console.log('Feeds');
        feeds.forEach(function (feed){
          console.log('%s - %s (%s)', feed.title, feed.htmlurl, feed.xmlurl);
        });
      }
    }

    parser.parseFile('./opml', myCallback);

    // To use the stream interface with a callback, you *MUST* use parseStream(), not piping
    parser.parseStream(fs.createReadStream('./opml'), myCallback);
```
