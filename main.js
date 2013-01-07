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
  , url = require('url')
  , util = require('util')
  , events = require('events')
  , utils = require('./utils');

function handleMeta (node){
  if (!node) return {};

  var meta = {};
  // Set all the meta keys to null
  ['title', 'dateCreated', 'dateModified', 'ownerName', 'ownerEmail', 'ownerEmail', 'docs', 'expansionState', 'vertScrollState', 'windowTop', 'windowLeft', 'windowBottom', 'windowRight'].forEach(function (property){
    meta[property] = null;
  });

  Object.keys(node).forEach(function(name){
    var el = node[name];
    switch(name){
    case('title'):
      meta.title = utils.get(el);
      break;
    case('datecreated'):
      meta.dateCreated = utils.get(el) ? new Date(el['#']) : null;
      break;
    case('datemodified'):
      meta.dateModified = utils.get(el) ? new Date(el['#']) : null;
      break;
    case('ownername'):
      meta.ownerName = utils.get(el);
      break;
    case('ownerid'):
      meta.ownerId = utils.get(el);
      break;
    case('docs'):
      meta.docs = utils.get(el);
      break;
    case('expansionstate'):
      meta.expansionState = utils.get(el);
      break;
    case('vertscrollstate'):
      meta.vertScrollState = utils.get(el);
      break;
    case('windowtop'):
      meta.windowTop = utils.get(el);
      break;
    case('windowleft'):
      meta.windowLeft = utils.get(el);
      break;
    case('windowbottom'):
      meta.windowBottom = utils.get(el);
      break;
    case('windowright'):
      meta.windowRight = utils.get(el);
      break;
    }
    // Fill with all native other namespaced properties
    if (name.indexOf('#') !== 0 && ~name.indexOf(':')) meta[name] = el;
  });
  return meta;
}

function getFolderName (node){
  if (!node) return '';

  if (utils.get(node, '#name') == 'outline' && utils.get(node, '@') && utils.get(node['@'], 'text'))
    return utils.get(node['@'], 'text');
  else
    return '';
}

function getCategories (node){
  if (!node || !('category' in node)) return [];
  else return utils.get(node, 'category').split(',').map(function (cat){ return cat.trim(); });
}

/**
 * OpmlParser constructor. Most apps will only use one instance.
 *
 * @api public
 */
function OpmlParser () {
  var self = this;
  self._reset();
  self.stream = sax.createStream(false, {lowercasetags: true}); // https://github.com/isaacs/sax-js
  self.stream.on('error', function (e){ self.handleSaxError(e, self); });
  self.stream.on('opentag', function (n){ self.handleOpenTag(n, self); });
  self.stream.on('closetag', function (el){ self.handleCloseTag(el, self); });
  self.stream.on('text', function (text){ self.handleText(text, self); });
  self.stream.on('cdata', function (text){ self.handleText(text, self); });
  self.stream.on('end', function (){ self.handleEnd(self); });
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

OpmlParser.prototype.handleEnd = function (scope){
  var self = scope;
  var meta = self.meta
    , feeds = (self.feeds.length ? self.feeds : null)
    , outline = self.outline;

  self.emit('outline', outline);
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
  self._reset();
};

OpmlParser.prototype.handleSaxError = function (e, scope){
  var self = scope;
  self.handleError(e, self);
  if (self._parser) {
    self._parser.error = null;
    self._parser.resume();
  }
};

OpmlParser.prototype.handleError = function (e, scope){
  var self = scope;
  self.emit('error', e);
  self.errors.push(e);
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
  }

  if (Object.keys(node.attributes).length) {
    n['@'] = handleAttributes(node.attributes, n['#name']);
  }

  if (self.stack.length === 0 && n['#name'] == 'opml') {
    self.meta['#ns'] = [];
    self.meta['@'] = [];
    Object.keys(n['@']).forEach(function(name) {
      var o = {};
      o[name] = n['@'][name];
      if (name.indexOf('xmlns') === 0) {
        self.meta['#ns'].push(o);
      } else if (name != 'version') {
        self.meta['@'].push(o);
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
      utils.merge(self.meta, handleMeta(self.stack[1].head), true);
      self.emit('meta', self.meta);
    }
    // These three lines reassign attributes to properties of the outline object and
    // preserve child outlines
    var children = n.outline;
    n = n['@'];
    if ('category' in n) n['categories'] = getCategories(n);
    if (children) n.outline = children;

    if ('xmlurl' in n) { // a feed is found
      var feed = n;
      feed.folder = getFolderName(self.stack[0]);
      feed.meta = self.meta;
      self.emit('feed', feed);
      self.feeds.push(feed);
    }
  } else if (el == 'head' && !self.meta.title) { // We haven't yet parsed all the metadata
    utils.merge(self.meta, handleMeta(n), true);
    self.emit('meta', self.meta);
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

exports = module.exports = OpmlParser;