describe('bad', function () {

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

  beforeEach(function () {
    opmlparser = new OpmlParser();
  });

  it('does not throw when parsing a terribly malformed fragment on an outline', function (done) {
    opmlparser.on('error', function (err) {
      // noop error handler
    });
    opmlparser.on('readable', handle.bind(opmlparser, function (outline) {
      assert(outline);
    }));
    opmlparser.on('end', done);
    createReadStream(__dirname + '/opml/malformed.opml').pipe(opmlparser);
  });

  it('emits an error when parsing a terribly malformed fragment on an outline', function (done) {
    var error;
    opmlparser.on('error', function (err) {
      error = err;
    });
    opmlparser.on('readable', handle.bind(opmlparser, function (outline) {
      assert(outline);
    }));
    opmlparser.on('end', function () {
      assert(error instanceof Error);
      assert.equal(error.message, 'Not an outline');
      done();
    });
    createReadStream(__dirname + '/opml/malformed.opml').pipe(opmlparser);
  });
});