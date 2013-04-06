/**********************************************************************
 node-opmlparser - OPML parser for node.
 http://github.com/danmactough/node-opmlparser
 Copyright (c) 2011 Dan MacTough
  http://yabfog.com

**********************************************************************/
/*jshint sub:true, laxcomma:true */
/**
 * Module dependencies.
 */
var sax = require('sax')
  , request = require('request')
  , fs = require('fs')
  , util = require('util')
  , EventEmitter = require('events').EventEmitter
  , utils = require('./utils');

/**
 * OpmlParser constructor. Most apps will only use one instance.
 *
 * @api public
 */
function OpmlParser () {
  this._reset();
  // See https://github.com/isaacs/sax-js for more info
  this.stream = sax.createStream(false /* strict mode - no by default */, {lowercase: true, xmlns: false });
  this.stream.on('error', this.handleError.bind(this, this.handleSaxError.bind(this)));
  this.stream.on('opentag', this.handleOpenTag.bind(this));
  this.stream.on('closetag',this.handleCloseTag.bind(this));
  this.stream.on('text', this.handleText.bind(this));
  this.stream.on('cdata', this.handleText.bind(this));
  this.stream.on('end', this.handleEnd.bind(this));
  EventEmitter.call(this);
}

util.inherits(OpmlParser, EventEmitter);

OpmlParser.prototype.handleEnd = function () {
  var meta = this.meta
    , feeds = (this.feeds.length ? this.feeds : null)
    , outline = this.outline;

  this.emit('outline', outline);
  this.emit('end', meta, feeds, outline);

  if ('function' == typeof this.callback) {
    if (this.errors.length) {
      var error = this.errors.pop();
      if (this.errors.length) {
        error.errors = this.errors;
      }
      this.callback(error);
    } else {
      this.callback(null, meta, feeds, outline);
    }
  }
  this._reset();
};

OpmlParser.prototype.handleSaxError = function () {
  if (this.stream._parser) {
    this.stream._parser.error = null;
    this.stream._parser.resume();
  }
};

OpmlParser.prototype.handleError = function (next, e) {
  // A SaxError will prepend an error-handling callback,
  // but other calls to #handleError will not
  if (next && !e) {
    e = next;
    next = null;
  }
  // Only emit the error event if we are not using CPS or
  // if we have a listener on 'error' even if we are using CPS
  if (!this.silenceErrors && (!this.callback || this.listeners('error').length)) {
    this.emit('error', e);
  }
  this.errors.push(e);
  if (typeof next === 'function') {
    next();
  } else {
    ['opentag', 'closetag', 'text', 'cdata', 'end'].forEach(function(ev){
      this.stream && this.stream.removeAllListeners(ev);
    }, this);
    this.handleEnd();
  }
};

OpmlParser.prototype.handleOpenTag = function (node) {
  var n = {};
  n['#name'] = node.name; // Avoid namespace collissions later...
  n['@'] = {};
  n['#'] = '';

  if (Object.keys(node.attributes).length) {
    n['@'] = this.handleAttributes(node.attributes, n['#name']);
  }

  if (this.stack.length === 0 && n['#name'] == 'opml') {
    this.meta['#ns'] = [];
    this.meta['@'] = [];
    Object.keys(n['@']).forEach(function(name) {
      var o = {};
      o[name] = n['@'][name];
      if (name.indexOf('xmlns') === 0) {
        this.meta['#ns'].push(o);
      } else if (name != 'version') {
        this.meta['@'].push(o);
      }
    }, this);
    this.meta['#version'] = n['@']['version'] || '1.1';
  }
  this.stack.unshift(n);
};

OpmlParser.prototype.handleCloseTag = function (el) {
  var n = this.stack.shift();
  delete n['#name'];

  if (this.xmlbase.length && (el == this.xmlbase[0]['#name'])) {
    void this.xmlbase.shift();
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
    if (!this.meta.title) { // We haven't yet parsed all the metadata
      utils.merge(this.meta, this.handleMeta(this.stack[1].head), true);
      this.emit('meta', this.meta);
    }
    // These three lines reassign attributes to properties of the outline object and
    // preserve child outlines
    var children = n.outline;
    n = n['@'];
    if ('category' in n) n['categories'] = this.getCategories(n);
    if (children) n.outline = children;

    if ('xmlurl' in n) { // a feed is found
      var feed = n;
      feed.folder = this.getFolderName(this.stack[0]);
      feed.meta = this.meta;
      this.emit('feed', feed);
      this.feeds.push(feed);
    }
  } else if (el == 'head' && !this.meta.title) { // We haven't yet parsed all the metadata
    utils.merge(this.meta, this.handleMeta(n), true);
    this.emit('meta', this.meta);
  }

  if (this.stack.length > 0) {
    if (!utils.has(this.stack[0], el)) {
      if (this.stack[0]['#name'] == 'outline' || this.stack[0]['#name'] == 'body') this.stack[0][el] = [n];
      else this.stack[0][el] = n;
    } else if (this.stack[0][el] instanceof Array) {
      this.stack[0][el].push(n);
    } else {
      this.stack[0][el] = [this.stack[0][el], n];
    }
  } else {
    if ('body' in n && 'outline' in n.body) {
      this.outline = n.body.outline;
    }
  }
};

OpmlParser.prototype.handleText = function (text) {
  if (this.stack.length) {
    if (this.stack[0] && '#' in this.stack[0]) {
      this.stack[0]['#'] += text;
    } else {
      this.stack[0]['#'] = text;
    }
  }
};

OpmlParser.prototype.handleAttributes = function (attrs, el) {
  Object.keys(attrs).forEach(function(name){
    if (this.xmlbase.length && (name == 'href' || name == 'src')) {
      // Apply xml:base to these elements as they appear
      // rather than leaving it to the ultimate parser
      attrs[name] = utils.resolve(this.xmlbase[0]['#'], attrs[name]);
    } else if (name == 'xml:base') {
      if (this.xmlbase.length) {
        attrs[name] = utils.resolve(this.xmlbase[0]['#'], attrs[name]);
      }
      this.xmlbase.unshift({ '#name': el, '#': attrs[name]});
    }
    attrs[name] = attrs[name] ? attrs[name].trim() : '';
  }, this);
  return attrs;
};

OpmlParser.prototype.handleMeta = function (node) {
  if (!node) return {};

  var meta = {};
  // Set all the meta keys to null
  ['title', 'datecreated', 'datemodified', 'ownername', 'owneremail', 'owneremail', 'docs', 'expansionstate', 'vertscrollstate', 'windowtop', 'windowleft', 'windowbottom', 'windowright'].forEach(function (property){
    meta[property] = null;
  });

  Object.keys(node).forEach(function(name){
    var el = node[name];
    switch(name){
    case('title'):
      meta.title = utils.get(el);
      break;
    case('datecreated'):
    case('datemodified'):
      meta[name] = utils.get(el) ? new Date(el['#']) : null;
      break;
    case('ownername'):
    case('ownerid'):
    case('docs'):
    case('expansionstate'):
    case('vertscrollstate'):
    case('windowtop'):
    case('windowleft'):
    case('windowbottom'):
    case('windowright'):
      meta[name] = utils.get(el);
      break;
    }
    // Fill with all native other namespaced properties
    if (name.indexOf('#') !== 0 && ~name.indexOf(':')) meta[name] = el;
  });
  return meta;
};

OpmlParser.prototype.getFolderName = function (node) {
  if (!node) return '';

  if (utils.get(node, '#name') == 'outline' && utils.get(node, '@') && utils.get(node['@'], 'text'))
    return utils.get(node['@'], 'text');
  else
    return '';
};

OpmlParser.prototype.getCategories = function (node) {
  if (!node || !('category' in node)) return [];
  else return utils.unique(utils.get(node, 'category').split(',').map(function (cat){ return cat.trim(); }));
};

OpmlParser.prototype._reset = function () {
  this.meta = {};
  this.feeds = [];
  this.stack = [];
  this.outline = {};
  this.xmlbase = [];
  this.errors = [];
  this.callback = undefined;
};

OpmlParser.prototype._setCallback = function (callback){
  this.callback = ('function' == typeof callback) ? callback : undefined;
};

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
 *     #ns {Array} key,value pairs of each namespace declared for the OPML
 *     @ {Array} key,value pairs of each attribute set in the root <opml> element
 *     #version {String}
 *     title {String}
 *     dateCreated {Date}
 *     dateModified {Date}
 *     ownerName {String}
 *     ownerId {String}
 *     docs {String}
 *     expansionState {String}
 *     vertScrollState {String}
 *     windowTop {String}
 *     windowLeft {String}
 *     windowBottom {String}
 *     windowRight {String}
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
  self._setCallback(callback);
  self.stream
    .on('error', function (e){ self.handleError(e, self); })
    .end(string, 'utf8');
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
    self._setCallback(callback);
    fs.createReadStream(file)
      .on('error', function (e){ self.handleError(e, self); })
      .pipe(self.stream);
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
  self._setCallback(callback);
  request(url)
    .on('error', function (e){ self.handleError(e, self); })
    .pipe(self.stream);
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
  self._setCallback(callback);
  stream
    .on('error', function (e){ self.handleError(e, self); })
    .pipe(self.stream);
};

exports = module.exports = OpmlParser;