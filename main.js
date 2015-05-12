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
  , util = require('util')
  , TransformStream = require('readable-stream').Transform
  , utils = require('./utils')
  ;

/**
 * OpmlParser constructor. Most apps will only use one instance.
 *
 * @api public
 */
function OpmlParser (options) {
  if (!(this instanceof OpmlParser)) return new OpmlParser(options);
  TransformStream.call(this);
  this._readableState.objectMode = true;
  this._readableState.highWaterMark = 16; // max. # of output nodes buffered

  this.init();
  this.parseOpts(options);
  // See https://github.com/isaacs/sax-js for more info
  this.stream = sax.createStream(this.options.strict /* strict mode - no by default */, {lowercase: true, xmlns: false });
  this.stream.on('error', this.handleSaxError.bind(this));
  this.stream.on('processinginstruction', this.handleProcessingInstruction.bind(this));
  this.stream.on('opentag', this.handleOpenTag.bind(this));
  this.stream.on('closetag',this.handleCloseTag.bind(this));
  this.stream.on('text', this.handleText.bind(this));
  this.stream.on('cdata', this.handleText.bind(this));
  this.stream.on('end', this.handleEnd.bind(this));
}
util.inherits(OpmlParser, TransformStream);

/*
 * Initializes the SAX stream
 *
 * Initializes the class-variables
 */
OpmlParser.prototype.init = function (){
  this.meta = {
    '#ns': []
  , '@': []
  , '#xml': {}
  };
  this.stack = [];
  this.xmlbase = [];
  this.errors = [];
  this.counter = 0;
};

/*
 * Parse options
 */
OpmlParser.prototype.parseOpts = function (options) {
  this.options = options || {};
  if (!('strict' in this.options)) this.options.strict = false;
  if (!('resume_saxerror' in this.options)) this.options.resume_saxerror = true;
  if ('MAX_BUFFER_LENGTH' in this.options) {
    sax.MAX_BUFFER_LENGTH = this.options.MAX_BUFFER_LENGTH; // set to Infinity to have unlimited buffers
  } else {
    sax.MAX_BUFFER_LENGTH = 16 * 1024 * 1024; // 16M versus the 64K default
  }
  if (this.options.opmlurl) this.xmlbase.unshift({ '#name': 'xml', '#': this.options.opmlurl});
};

OpmlParser.prototype.handleEnd = function () {
  // We made it to the end without throwing, but let's make sure we were actually
  // parsing a feed
  if (!(this.meta && this.meta['#type'] === 'opml')) {
    var e = new Error('Not an outline');
    return this.handleError(e);
  }
  this.push(null);
};

OpmlParser.prototype.handleSaxError = function (e) {
  this.emit('error', e);
  if (this.options.resume_saxerror) {
    this.resumeSaxError();
  }
};

OpmlParser.prototype.resumeSaxError = function () {
  if (this.stream._parser) {
    this.stream._parser.error = null;
    this.stream._parser.resume();
  }
};

OpmlParser.prototype.handleError = function (e) {
  this.emit('error', e);
};

OpmlParser.prototype.handleProcessingInstruction = function (node) {
  if (node.name !== 'xml') return;
  this.meta['#xml'] = node.body.trim().split(' ').reduce(function (map, attr) {
    var parts = attr.split('=');
    map[parts[0]] = parts[1] && parts[1].length > 2 && parts[1].match(/^.(.*?).$/)[1];
    return map;
  }, {});
};

OpmlParser.prototype.handleOpenTag = function (node) {
  // First, update the current xml:base so that URI resolutions are correct
  this.joinXmlBase(node);

  var n = {
    '#name': node.name, // Avoid namespace collissions later...
    '#prefix': node.prefix, // The current ns prefix
    '#local': node.local, // The current element name, sans prefix
    '#uri': node.uri, // The current ns uri
    '#type': utils.nslookup(node.uri, 'opml') || utils.nslookup(node.uri, undefined) ? 'opml' : null, // make it easier to check if this is a standard opml node
    '@': this.handleAttributes(node),
    '#': ''
  };

  // Handle root node
  if (this.stack.length === 0 &&
     (n['#name'] === 'opml' || (n['#local'] === 'opml' && n['#type'] === 'opml'))) {
    this.meta['#type'] = 'opml';
    this.meta['#ns'] = {};
    this.meta['@'] = {};
    Object.keys(n['@']).forEach(function (name) {
      if (name.indexOf('xmlns') === 0) {
        this.meta['#ns'][name] = n['@'][name];
      } else if (name !== 'version') {
        this.meta['@'][name] = n['@'][name];
      }
    }, this);
    this.meta['#version'] = n['@']['version'] || '1.1';
  }
  // Track the outline count so we can later walk the tree
  if (n['#name'] === 'outline' || (n['#local'] === 'outline' && n['#type'] === 'opml')) {
    n['#isoutline'] = true;
    n['@']['#id'] = ++this.counter;
    n['@']['#parentid'] = this.getParentId();
    if ('category' in n['@']) n['@']['categories'] = this.getCategories(n['@']);
    if ('xmlurl' in n['@'] || n['@']['type'] === 'rss') { // a feed is found
      n['@']['#type'] = 'feed';
      n['@']['folder'] = this.getFolderName(this.stack[0]);
    }
  }
  this.stack.unshift(n);
};

OpmlParser.prototype.handleCloseTag = function (el) {
  var n = this.stack.shift()
    , baseurl
    , stdEl;

  if (this.xmlbase && this.xmlbase.length) {
    baseurl = this.xmlbase[0]['#'];
    if (n['#name'] === this.xmlbase[0]['#name']) {
      void this.xmlbase.shift();
    }
  }

  // Normalize the text node
  if ('#' in n) {
    if (n['#'].match(/^\s*$/)) {
      // Delete text nodes with nothing by whitespace
      delete n['#'];
    } else {
      n['#'] = n['#'].trim();
      // If this is a bare text node with no attributes, set the property value
      // as the value of the text node, unless it's an outline element
      if (!n['#isoutline'] && Object.keys(n).filter(function (key) { return key !== '@' || !Object.keys(n[key]).length; }).length === 1) {
        n = n['#'];
        // I'm through with this guy...
        return;
      }
    }
  }

  if (n['#isoutline']) { // We have an outline node
    if (!this.meta.title && this.stack[1] && this.stack[1].head) { // We haven't yet parsed all the metadata
      utils.merge(this.meta, this.handleMeta(this.stack[1].head), true);
    }
    if (!baseurl && this.xmlbase && this.xmlbase.length) { // handleMeta was able to infer a baseurl without xml:base or options.feedurl
      n = utils.reresolve(n, this.xmlbase[0]['#']);
    }
    // All the information in a outline element is in the attributes.
    this.push(n['@']);
  } else if ((n['#name'] === 'head' ||
            (n['#local'] === 'head' && n['#type'] === 'opml')) &&
            !this.meta.title) { // We haven't yet parsed all the metadata
    utils.merge(this.meta, this.handleMeta(n), true);
  }

  if (this.stack.length > 0) {
    if (n['#prefix'] && n['#local'] && !n['#type']) {
      stdEl = n['#prefix'] + ':' + n['#local'];
    } else if (n['#name'] && n['#type'] && n['#type'] !== this.meta['#type']) {
      stdEl = n['#name'];
    } else {
      stdEl = n['#local'] || n['#name'];
    }
    if (!this.stack[0].hasOwnProperty(stdEl)) {
      this.stack[0][stdEl] = n;
    } else if (this.stack[0][stdEl] instanceof Array) {
      this.stack[0][stdEl].push(n);
    } else {
      this.stack[0][stdEl] = [this.stack[0][stdEl], n];
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

OpmlParser.prototype.joinXmlBase = function (node) {
  if ('xml:base' in node.attributes) {
    if (this.xmlbase.length) {
      node.attributes['xml:base'] = utils.resolve(this.xmlbase[0]['#'], node.attributes['xml:base'].trim());
    }
    this.xmlbase.unshift({ '#name': node.name, '#': node.attributes['xml:base']});
  }
};

OpmlParser.prototype.handleAttributes = function (node) {
  var attrs = {}
    , names = Object.keys(node.attributes);
  if (names.length) {
    names.forEach(function (name) {
      if (this.xmlbase.length && (name === 'href' || name === 'src')) {
        // Apply xml:base to these elements as they appear
        // rather than leaving it to the ultimate parser
        attrs[name] = node.attributes[name] ? utils.resolve(this.xmlbase[0]['#'], node.attributes[name].trim()) : '';
      }
      else {
        attrs[name] = node.attributes[name] ? node.attributes[name].trim() : '';
      }
    }, this);
  }
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
    if (name.indexOf('#') !== 0) {
      if (~name.indexOf(':')) meta[name] = el;
      else if (!(name in meta)) {
        // allow arbitrary elements in head and assume the #text is the value
        meta[name] = utils.get(el);
      }
    }

    // if (name.indexOf('#') !== 0 && ~name.indexOf(':')) meta[name] = el;
  });
  return meta;
};

OpmlParser.prototype.getParentId = function () {
  var parent = this.stack.length && this.stack[0];
  return ((parent && (parent['#name'] === 'outline' || (parent['#local'] === 'outline' && utils.nslookup([parent['#uri']], 'opml')))) ?
          parent['@']['#id'] :
          0);
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
OpmlParser.prototype._transform = function (data, encoding, done) {
  this.stream.write(data);
  done();
};

OpmlParser.prototype._flush = function (done) {
  this.stream.end();
  done();
};

exports = module.exports = OpmlParser;