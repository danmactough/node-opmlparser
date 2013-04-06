/*global assert:true, opmlparser:true, server:true*/
var URL = require('url');

assert = require('assert');
opmlparser = require('../');
server = function (done) {
  var app = require('http').createServer();
  var stream = require('fs').createReadStream;
  app.on('request', function (req, res) {
    var url = URL.parse(req.url, true);
    stream(__dirname + '/opml' + url.pathname).pipe(res);
  });
  app.listen(21337, function () {
    done && done();
  });
  server.app = app;
  server.close = function (done) {
    app.close.call(app, function (){
      delete server.app;
      delete require.cache.buffet;
      done && done();
    });
  };
};
