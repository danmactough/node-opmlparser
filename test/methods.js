describe('methods', function () {

  before(function (done) {
    server(done);
  });

  after(function (done) {
    server.close(done);
  });

  // it('can parse a string', function (done) {
  //   // see basic.js
  // });

  it('can parse a file', function (done) {
    opmlparser.parseFile(__dirname + '/opml/outline.opml', function (err) {
      assert.ifError(err);
      done();
    });
  });

  it('can parse a url', function (done) {
    opmlparser.parseUrl('http://localhost:21337/outline.opml', function (err) {
      assert.ifError(err);
      done();
    });
  });

  it('can parse a stream', function (done) {
    opmlparser.parseStream(require('fs').createReadStream(__dirname + '/opml/outline.opml'), function (err) {
      assert.ifError(err);
      done();
    });
  });


});