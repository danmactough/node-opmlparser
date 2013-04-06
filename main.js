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
  , URL = require('url')
  , util = require('util')
  , Stream = require('stream').Stream
  , STATUS_CODES = require('http').STATUS_CODES
  , utils = require('./utils');

/**
 * OpmlParser constructor. Most apps will only use one instance.
 *
 * @api public
 */
function OpmlParser (options) {
  if (!(this instanceof OpmlParser)) return new OpmlParser(options);
  this.init();
  this.parseOpts(options);
  // See https://github.com/isaacs/sax-js for more info
  this.stream = sax.createStream(this.options.strict /* strict mode - no by default */, {lowercase: true, xmlns: false });
  this.stream.on('error', this.handleError.bind(this, this.handleSaxError.bind(this)));
  this.stream.on('opentag', this.handleOpenTag.bind(this));
  this.stream.on('closetag',this.handleCloseTag.bind(this));
  this.stream.on('text', this.handleText.bind(this));
  this.stream.on('cdata', this.handleText.bind(this));
  this.stream.on('end', this.handleEnd.bind(this));
  Stream.call(this);
  this.writable = true;
  this.readable = true;
}
util.inherits(OpmlParser, Stream);

/*
 * Initializes the SAX stream
 *
 * Initializes the class-variables
 */
OpmlParser.prototype.init = function (){
  this.meta = {
    '#ns': []
  , '@': []
  };
  this.feeds = [];
  this.outline = {};
  this.stack = [];
  this.xmlbase = [];
  this.errors = [];
  this.silenceErrors = false;
};

/*
 * Parse options
 */
OpmlParser.prototype.parseOpts = function (options) {
  this.options = options || {};
  if (!('strict' in this.options)) this.options.strict = false;
  if (!('addmeta' in this.options)) this.options.addmeta = true;
  if ('MAX_BUFFER_LENGTH' in this.options) {
    sax.MAX_BUFFER_LENGTH = this.options.MAX_BUFFER_LENGTH; // set to Infinity to have unlimited buffers
  } else {
    sax.MAX_BUFFER_LENGTH = 16 * 1024 * 1024; // 16M versus the 64K default
  }
  if (this.options.opmlurl) this.xmlbase.unshift({ '#name': 'xml', '#': this.options.opmlurl});
};

OpmlParser.prototype.handleEnd = function () {
  var meta = this.meta
    , feeds = (this.feeds.length ? this.feeds : null)
    , outline = this.outline;

  if ('function' === typeof this.callback) {
    if (this.errors.length) {
      var error = this.errors.pop();
      if (this.errors.length) {
        error.errors = this.errors;
      }
      this.callback(error);
    } else {
      this.callback(null,  meta, feeds, outline);
    }
  }
  if (!this.errors.length) {
    this.emit('outline', outline);
    this.emit('complete',  meta, feeds, outline);
  }
  this.emit('end');
  if (this.stream) {
    this.stream.removeAllListeners('end');
    this.stream.removeAllListeners('error');
  }
  this.stream.on('error', function() {});
  this.stream._parser.close();
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
  var n = this.stack.shift()
    , baseurl;

  delete n['#name'];

  if (this.xmlbase && this.xmlbase.length) {
    baseurl = this.xmlbase[0]['#'];
  }

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
    if (!baseurl && this.xmlbase && this.xmlbase.length) { // handleMeta was able to infer a baseurl without xml:base or options.feedurl
      n = utils.reresolve(n, this.xmlbase[0]['#']);
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
      if (this.options.addmeta) {
        feed.meta = this.meta;
      }
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

// Naive Stream API
OpmlParser.prototype.write = function (data) {
  this.stream.write(data);
  return true;
};

OpmlParser.prototype.end = function (chunk) {
  if (chunk && chunk.length) this.stream.write(chunk);
  this.stream.end();
  return true;
};

function opmlparser (options, callback) {
  if ('function' === typeof options) {
    callback = options;
    options = {};
  }
  var op = new OpmlParser(options);
  op.callback = callback;
  return op;
}

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

OpmlParser.parseString = function(string, options, callback) {
  var op = opmlparser(options, callback);
  // Must delay to give caller a change to attach event handlers
  process.nextTick(function(){
    op.stream
      .on('error', op.handleError.bind(op))
      .end(string, Buffer.isBuffer(string) ? null : 'utf8'); // Accomodate a Buffer in addition to a String
  });
  return op;
};

/**
 * Parses OPML from a file or (for compatability with libxml) a url.
 * See parseString for more info.
 *
 * @param {String} path to the OPML file or a fully qualified uri or parsed url object from url.parse()
 * @param {Function} callback
 * @api public
 */

OpmlParser.parseFile = function(file, options, callback) {
  if (/^https?:/.test(file) || (typeof file === 'object' && ('href' in file || 'uri' in file || 'url' in file))) {
    return OpmlParser.parseUrl(file, options, callback);
  }
  var op = opmlparser(options, callback);
  fs.createReadStream(file)
    .on('error', op.handleError.bind(op))
    .pipe(op.stream);
  return op;
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

OpmlParser.parseUrl = function(url, options, callback) {
  var op = opmlparser(options, callback);

  var handleResponse = function (response) {
    op.response = response;
    op.emit('response', response);
    var code = response.statusCode;
    var codeReason = STATUS_CODES[code] || 'Unknown Failure';
    var contentType = response.headers && response.headers['content-type'];
    var e = new Error();
    if (code !== 200) {
      if (code === 304) {
        op.emit('304');
        op.meta = op.feeds = op.outline = null;
        op.silenceErrors = true;
        op.removeAllListeners('complete');
        op.removeAllListeners('meta');
        op.removeAllListeners('feed');
        op.removeAllListeners('outline');
        op.handleEnd();
      }
      else {
        e.message = 'Remote server responded: ' + codeReason;
        e.code = code;
        e.url = url;
        op.handleError(e);
        response.request && response.request.abort();
      }
      return;
    }
    op.meta['#content-type'] = contentType;
    return;
  };

  // Make sure we have a url and normalize the request object
  var invalid = 'Invalid URL: must be a string or valid request object - %s';

  if (/^https?:/.test(url)) {
    url = {
      uri: url
    };
  } else if (url && typeof url === 'object') {
    if ('href' in url) { // parsed url
      if (!/^https?:/.test(URL.format(url))) {
        throw (new Error(util.format(invalid, url)));
      }
      url = {
        url: url
      };
    } else {
      if (url.url && url.uri) delete url.uri; // wtf?!
      if (! (url.url || url.uri) ) throw (new Error(util.format(invalid, url)));
      if (url.url) {
        if (/^https?:/.test(url.url)) {
          url.uri = url.url;
          delete url.url;
        } else if ( !(typeof url.url === 'object' && 'href' in url.url && /^https?:/.test(URL.format(url.url))) ) {
          // not a string, not a parsed url
          throw (new Error(util.format(invalid, url.url)));
        }
      }
      if (url.uri) {
        if ( typeof url.uri === 'object' && 'href' in url.uri && /^https?:/.test(URL.format(url.uri)) ) {
          url.url = url.uri;
          delete url.uri;
        } else if (!/^https?:/.test(url.uri)) {
          // not a string, not a parsed url
          throw (new Error(util.format(invalid, url.uri)));
        }
      }
    }
  } else {
    throw (new Error(util.format(invalid, url)));
  }

  url.headers = url.headers || {};
  url.headers['Accept-Encoding'] = 'identity';

  if (!op.xmlbase.length) {
    if (url.uri) {
      op.xmlbase.unshift({ '#name': 'xml', '#': url.uri });
    } else if (url.url) {
      op.xmlbase.unshift({ '#name': 'xml', '#': URL.format(url.url) });
    }
  }

  request(url)
    .on('error', op.handleError.bind(op))
    .on('response', handleResponse)
    .pipe(op.stream)
    ;
  return op;
};

/**
 * Parses a OPML from a Stream.
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

OpmlParser.parseStream = function(stream, options, callback) {
  var op = opmlparser(options, callback);
  stream && stream
    .on('error', op.handleError.bind(op))
    .pipe(op.stream);
  return op;
};

exports = module.exports = OpmlParser;