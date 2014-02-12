describe('basic', function () {

  var opmlparser, comparisons;

  function handle (comparator) {
    var stream = this, outline;
    while (outline = stream.read()) {
      comparator(outline);
    }
  }

  beforeEach(function () {
    opmlparser = new OpmlParser();
    comparisons = {};
  });

  it('can parse an outline', function (done) {
    var comparisons = {
      1: "1. This is an outine element with an <a href=\"http://www.google.com/?q=anchor%20tag\">anchor tag</a>.",
      2: "2. Next outline element",
      3: "3. Outline element with one child",
      4: "a. I'm a child",
      5: "4. I'm after the the child"
    };
    opmlparser.on('error', function (err) {
      assert.ifError(err);
      done(err);
    });
    opmlparser.on('end', done);
    opmlparser.once('readable', function () {
      assert.equal(this.meta.title, 'Outline Title');
    });
    opmlparser.on('readable', handle.bind(opmlparser, function (outline) {
      assert(outline);
      assert.equal(comparisons[outline['#id']], outline.text);
    }));
    createReadStream(__dirname + '/opml/outline.opml').pipe(opmlparser);
  });

  it('can parse an outline\'s categories', function (done) {
    opmlparser.on('error', function (err) {
      assert.ifError(err);
      done(err);
    });
    opmlparser.on('end', done);
    opmlparser.once('readable', function () {
      assert.equal(this.meta.title, 'Illustrating the category attribute');
    });
    opmlparser.on('readable', handle.bind(opmlparser, function (outline) {
      assert(outline);
      assert.equal(outline.category, '/Tourism/New York,/Philosophy/Baseball/Mets,/Tourism/New York');
      assert.deepEqual(outline.categories.sort(), ['/Tourism/New York','/Philosophy/Baseball/Mets'].sort());
    }));
    createReadStream(__dirname + '/opml/categories.opml').pipe(opmlparser);
  });

  it('can get feeds from a subscription list', function (done) {
    var feeds = [];
    opmlparser.on('error', function (err) {
      assert.ifError(err);
      done(err);
    });
    opmlparser.on('end', function () {
      assert.equal(feeds.length, 100);
      assert.equal(feeds[0].title, 'TechCrunch');
      done();
    });
    opmlparser.once('readable', function () {
      assert.equal(this.meta.title, 'Top 100 Feeds');
    });
    opmlparser.on('readable', handle.bind(opmlparser, function (outline) {
      assert(outline);
      if (outline['#type'] === 'feed') {
        feeds.push(outline);
      }
    }));
    createReadStream(__dirname + '/opml/top100.opml').pipe(opmlparser);
  });

  it('can handle an outline with an empty head', function (done) {
    opmlparser.on('error', function (err) {
      assert.ifError(err);
      done(err);
    });
    opmlparser.on('end', done);
    opmlparser.once('readable', function () {
      assert.equal(this.meta.title, null);
    });
    opmlparser.on('readable', handle.bind(opmlparser, function (outline) {
      assert(outline);
    }));
    createReadStream(__dirname + '/opml/empty-head.opml').pipe(opmlparser);
  });

  it('can handle and outline with no outline elements', function (done) {
    opmlparser.on('error', function (err) {
      assert.ifError(err);
      done(err);
    });
    opmlparser.on('end', done);
    opmlparser.once('readable', function () {
      assert.equal(this.meta.title, 'No Outlines');
    });
    opmlparser.on('readable', handle.bind(opmlparser, function () {
      throw new Error('Outline is not null');
    }));
    createReadStream(__dirname + '/opml/no-outlines.opml').pipe(opmlparser);
  });

});
