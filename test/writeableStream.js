describe('Writeable Stream Input API', function () {

  var filepath = __dirname + '/opml/top100.opml';

  var events = [];

  beforeEach(function () {
    events = [];
  })

  afterEach(function () {
    assert.equal(events.indexOf('error'), -1);
    assert.ok(~events.indexOf('meta'));
    assert.ok(~events.indexOf('feed'));
    assert.ok(~events.indexOf('outline'));
    assert.ok(~events.indexOf('complete'));
  });

  describe('.pipe()', function () {
    it('can accept a .pipe()', function (done) {
      require('fs').createReadStream(filepath).pipe(new opmlparser())
        .on('error', function (err) {
          assert.ifError(err);
          events.push('error');
        })
        .on('meta', function (meta) {
          assert.notEqual(meta, null);
          events.push('meta');
        })
        .on('feed', function (feed) {
          assert.notEqual(feed, null);
          events.push('feed');
        })
        .on('outline', function (outline) {
          assert.notEqual(outline, null);
          events.push('outline');
        })
        .on('complete', function (meta, feeds, outline) {
          assert.notEqual(meta, null);
          assert.ok(feeds.length);
          assert.notEqual(outline, null);
          events.push('complete');
        })
        .on('end', done);
    });
  });

});