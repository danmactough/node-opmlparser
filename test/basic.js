describe('basic', function () {

  it('can parse an outline', function (done) {
    var data = require('fs').readFileSync(__dirname + '/opml/outline.opml', 'utf8');
    opmlparser.parseString(data, function (err, meta, feeds, outline) {
      assert.ifError(err);
      assert.equal(meta.title, '07.opml');
      assert.equal(feeds, null);
      assert.equal(outline[2].text, 'There is');
      done();
    });
  });

  it('can get feeds from a subscription list', function (done) {
    var data = require('fs').readFileSync(__dirname + '/opml/top100.opml', 'utf8');
    opmlparser.parseString(data, function (err, meta, feeds, outline) {
      assert.ifError(err);
      assert.equal(meta.title, 'Top 100 Feeds');
      assert.equal(feeds.length, 100);
      assert.equal(feeds[0].title, 'TechCrunch');
      done();
    });
  });

  it('can parse an outline\'s categories', function (done) {
    var data = require('fs').readFileSync(__dirname + '/opml/categories.opml', 'utf8');
    opmlparser.parseString(data, function (err, meta, feeds, outline) {
      assert.ifError(err);
      assert.equal(outline[0].categories.length, 2);
      done();
    });
  });
});
