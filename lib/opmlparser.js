/**********************************************************************
 node-opmlparser - OPML parser for node.
 http://github.com/danmactough/node-opmlparser
 Copyright (c) 2011 Dan MacTough
  http://yabfog.com

**********************************************************************/

/**
 * Module dependencies.
 */
var sax = require('sax')
  , request = require('request')
  , fs = require('fs')
  , url = require('url')
  , util = require('util')
  , events = require('events');

// Ensures we have .trim() to strip leading and trailing whitespace from any string
if (!String.prototype.trim) {
  String.prototype.trim = function () {
    var str = this.replace(/^\s\s*/, '');
    var ws = /\s/
      , i = str.length;
    while (ws.test(str.charAt(--i)));
    return str.slice(0, i + 1);
  };
}

// Utility function to test for and extract a subkey
function getValue(obj, subkey) {
  if (!subkey)
    subkey = '#';
  if (obj && obj[subkey])
    return obj[subkey];
  else
    return null;
}

/**
 * OpmlParser constructor. Most apps will only use one instance.
 *
 * @api public
 */
function OpmlParser () {
  var self = this;
  self.saxStream = require('sax').createStream(false, {lowercasetags: true}); // https://github.com/isaacs/sax-js
  self.saxStream.on('error', function (e){ self.handleError(e, self) });
  self.saxStream.on('opentag', function (n){ self.handleOpenTag(n, self) });
  self.saxStream.on('closetag', function (el){ self.handleCloseTag(el, self) });
  self.saxStream.on('text', function (text){ self.handleText(text, self) });
  self.saxStream.on('cdata', function (text){ self.handleText(text, self) });
  self.saxStream.on('end', function (){ self.handleEnd(self) });
  events.EventEmitter.call(this);
}

util.inherits(OpmlParser, events.EventEmitter);

/**
 * Parses opml contained in a string.
 *
 * For each feed, emits a 'feed' event 
 * with an object containing the keys corresponding to the attributes that are present (or null)
 * (keep in mind that no validation is done, so other arbitrary (and invalid) attributes
 * may also be present):
 *   title {String}
 *   text {String}
 *   xmlUrl {String}
 *   htmlUrl {String}
 *   description {String}
 *   type {String}
 *   language {Object}
 *   version {Object}
 *   Object.keys(meta): (any of which may be null)
 *     #ns {Array} key,value pairs of each namespace declared for the feed
 *     #version {String}
 *     title {String}
 *     dateCreated {Date}
 *     dateModified {Date}
 *     ownerName {String}
 *     ownerId {String}
 *     docs {String}
 *
 * Emits a 'warning' event on each XML parser warning
 *
 * Emits an 'error' event on each XML parser error
 *
 * @param {String} string of OPML
 * @param {Function} callback
 * @api public
 */

OpmlParser.prototype.parseString = function(string, callback) {
  var self = this;
  self._reset(callback);
  self.saxStream.end(string, 'utf8');
};

/**
 * Parses OPML from a file or (for compatability with libxml) a url.
 * See parseString for more info.
 *
 * @param {String} path to the OPML file or a fully qualified uri or parsed url object from url.parse()
 * @param {Function} callback
 * @api public
 */

OpmlParser.prototype.parseFile = function(file, callback) {
  var self = this;
  if (/^https?:/.test(file) || (typeof file == 'object' && 'protocol' in file)) {
    self.parseUrl(file, callback);
  } else {
    self._reset(callback);
    fs.createReadStream(file).pipe(self.saxStream);
  }
};

/**
 * Parses OPML from a url.
 *
 * Please consider whether it would be better to perform conditional GETs 
 * and pass in the results instead.
 *
 * See parseString for more info.
 *
 * @param {String} fully qualified uri or a parsed url object from url.parse()
 * @param {Function} callback
 * @api public
 */

OpmlParser.prototype.parseUrl = function(url, callback) {
  var self = this;
  self._reset(callback);
  request(url).pipe(self.saxStream);
};

/**
 * Parses a feed from a Stream.
 *
 * Example:
 *    parser = new OpmlParser();
 *    parser.on('feed', function (feed){ // do something });
 *    parser.parseStream(fs.createReadStream('file.opml')[, callback]);
 *
 *
 * See parseString for more info.
 *
 * @param {String} fully qualified uri or a parsed url object from url.parse()
 * @param {Function} callback
 * @api public
 */

OpmlParser.prototype.parseStream = function(stream, callback) {
  var self = this;
  self._reset(callback);
  stream.pipe(self.saxStream);
};

OpmlParser.prototype.handleEnd = function (scope){
  var self = scope;
  var meta = self.meta
    , feeds = (self.feeds.length ? self.feeds : null)
    , outline = self.outline;

  self.emit('end', meta, feeds, outline);

  if ('function' == typeof self.callback) {
    if (self.errors.length) {
      var error = self.errors.pop();
      if (self.errors.length) {
        error.errors = self.errors;
      }
      self.callback(error);
    } else {
      self.callback(null, meta, feeds, outline);
    }
  }  
};

OpmlParser.prototype.handleError = function (e, scope){
  var self = scope;
  self.emit('error', e);
  self.errors.push(e);
  self._parser.error = null;
  self._parser.resume();
};

OpmlParser.prototype.handleOpenTag = function (node, scope){
  var self = scope;
  var n = {};
  n['#name'] = node.name; // Avoid namespace collissions later...
  n['@'] = {};
  n['#'] = '';

  function handleAttributes (attrs, el) {
    Object.keys(attrs).forEach(function(name){
      if (self.xmlbase.length && (name == 'href' || name == 'src')) {
        // Apply xml:base to these elements as they appear
        // rather than leaving it to the ultimate parser
        attrs[name] = url.resolve(self.xmlbase[0]['#'], attrs[name]);
      } else if (name == 'xml:base') {
        if (self.xmlbase.length) {
          attrs[name] = url.resolve(self.xmlbase[0]['#'], attrs[name]);
        }
        self.xmlbase.unshift({ '#name': el, '#': attrs[name]});
      }
      attrs[name] = attrs[name].trim();
    });
    return attrs;
  };

  if (Object.keys(node.attributes).length) {
    n['@'] = handleAttributes(node.attributes, n['#name']);
  }

  if (self.stack.length == 0 && n['#name'] == 'opml') {
    self.meta['#ns'] = [];
    Object.keys(n['@']).forEach(function(name) {
      if (name.indexOf('xmlns') == 0) {
        var o = new Object;
        o[name] = n['@'][name];
        self.meta['#ns'].push(o);
      }
    });
    self.meta['#version'] = n['@']['version'] || '1.1';
  }
  self.stack.unshift(n);
};

OpmlParser.prototype.handleCloseTag = function (el, scope){
  var self = scope;
  var n = self.stack.shift();
  delete n['#name'];

  if (self.xmlbase.length && (el == self.xmlbase[0]['#name'])) {
    void self.xmlbase.shift();
  }

  if ('#' in n) {
    if (n['#'].match(/^\s*$/)) {
      delete n['#'];
    } else {
      n['#'] = n['#'].trim();
      if (Object.keys(n).length === 1 && el != 'outline') {
        n = n['#'];
      }
    }
  }
  
  if (el == 'outline') { // We have an outline node
    if (!self.meta.title) { // We haven't yet parsed all the metadata
      // Set all the meta keys to null
      self.meta.title = self.meta.dateCreated = self.meta.dateModified = self.meta.ownerName = self.meta.ownerEmail = self.meta.ownerId = self.meta.docs 
        = null;
      if (self.stack[1].head) {
        Object.keys(self.stack[1].head).forEach(function(el){
          switch(el){
          case('title'):
            self.meta.title = getValue(self.stack[1].head[el]);
            break;
          case('datecreated'):
            self.meta.dateCreated = getValue(self.stack[1].head[el]) ? new Date(self.stack[1].head[el]['#']) : null;
            break;
          case('datemodified'):
            self.meta.dateModified = getValue(self.stack[1].head[el]) ? new Date(self.stack[1].head[el]['#']) : null;
            break;
          case('ownername'):
            self.meta.ownerName = getValue(self.stack[1].head[el]);
            break;
          case('ownerid'):
            self.meta.ownerId = getValue(self.stack[1].head[el]);
            break;
          case('docs'):
            self.meta.docs = getValue(self.stack[1].head[el]);
            break;
          }
        });
      }
      self.emit('meta', self.meta);
    }
    // These three lines reassign attributes to properties of the outline object and
    // presever child outlines
    var children = n.outline;
    n = n['@'];
    if (children) n.outline = children;

    if ('xmlUrl' in n) { // a feed is found
      var feed = n;
      feed.meta = self.meta;
      self.emit('feed', feed);
      self.feeds.push(feed);
    }
  }

  if (self.stack.length > 0) {
    if (!self.stack[0].hasOwnProperty(el)) {
      if (self.stack[0]['#name'] == 'outline' || self.stack[0]['#name'] == 'body') self.stack[0][el] = [n];
      else self.stack[0][el] = n;
    } else if (self.stack[0][el] instanceof Array) {
      self.stack[0][el].push(n);
    } else {
      self.stack[0][el] = [self.stack[0][el], n];
    }
  } else {
    if ('body' in n && 'outline' in n.body) {
      self.outline = n.body.outline;
    }
  }
};

OpmlParser.prototype.handleText = function (text, scope){
  var self = scope;
  if (self.stack.length) {
    if ('#' in self.stack[0]) {
      self.stack[0]['#'] += text;
    } else {
      self.stack[0]['#'] = text;
    }
  }
};

OpmlParser.prototype._reset = function (callback) {
  this.meta = {};
  this.feeds = [];
  this.stack = [];
  this.outline = {};
  this.xmlbase = [];
  this.errors = [];
  this.callback = ('function' == typeof callback) ? callback : undefined;
}

exports = module.exports = OpmlParser;