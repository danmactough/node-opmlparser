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
  , addressparser = require('addressparser')
  , indexOfObject = require('array-indexofobject')
  , resanitize = require('resanitize')
  , URL = require('url')
  , util = require('util')
  , TransformStream = require('stream').Transform
  , utils = require('./utils')
  ;

if (TransformStream === undefined) {
  TransformStream = require('readable-stream').Transform;
}

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
  this._emitted_meta = false;
  this.stack = [];
  this.xmlbase = [];
  this.errors = [];
};

/*
 * Parse options
 */
OpmlParser.prototype.parseOpts = function (options) {
  this.options = options || {};
  if (!('strict' in this.options)) this.options.strict = false;
  if (!('normalize' in this.options)) this.options.normalize = true;
  if (!('addmeta' in this.options)) this.options.addmeta = true;
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
  if (this.meta && !this.meta['#type']) {
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
  var n = {};
  n['#name'] = node.name; // Avoid namespace collissions later...
  n['#prefix'] = node.prefix; // The current ns prefix
  n['#local'] = node.local; // The current element name, sans prefix
  n['#uri'] = node.uri; // The current ns uri
  n['@'] = {};
  n['#'] = '';

  if (Object.keys(node.attributes).length) {
    n['@'] = this.handleAttributes(node.attributes, n['#name']);
  }

  if (this.stack.length === 0 &&
     (n['#name'] === 'opml' || (n['#local'] === 'opml' && utils.nslookup([n['#uri']], 'opml')))) {
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
  var node = { '#name' : el
             , '#prefix' : ''
             , '#local' : '' }
    , stdEl
    , item
    , baseurl
    ;
  var n = this.stack.shift();
  el = el.split(':');

  if (el.length > 1 && el[0] === n['#prefix']) {
    if (utils.nslookup(n['#uri'], 'opml')) {
      node['#prefix'] = el[0];
      node['#local'] = el.slice(1).join(':');
      node['#type'] = 'opml';
    } else {
      node['#prefix'] = utils.nsprefix(n['#uri']) || n['#prefix'];
      node['#local'] = el.slice(1).join(':');
    }
  } else {
    node['#local'] = node['#name'];
    node['#type'] = utils.nsprefix(n['#uri']) || n['#prefix'];
  }
  delete n['#name'];
  delete n['#local'];
  delete n['#prefix'];
  delete n['#uri'];

  if (this.xmlbase && this.xmlbase.length) {
    baseurl = this.xmlbase[0]['#'];
  }

  if (this.xmlbase.length && (el == this.xmlbase[0]['#name'])) {
    void this.xmlbase.shift();
  }

  if ('#' in n) {
    if (n['#'].match(/^\s*$/)) {
      // Delete text nodes with nothing by whitespace
      delete n['#'];
    } else {
      n['#'] = n['#'].trim();
      if (Object.keys(n).length === 1 && node['#name'] != 'outline') {
        n = n['#'];
      }
    }
  }

  if (node['#name'] === 'outline') { // We have an outline node
    if (!this.meta.title) { // We haven't yet parsed all the metadata
      utils.merge(this.meta, this.handleMeta(this.stack[1].head), true);
      if (!this._emitted_meta) {
        this.emit('meta', this.meta);
        this._emitted_meta = true;
      }
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
      n.folder = this.getFolderName(this.stack[0]);
      if (this.options.addmeta) {
        n.meta = this.meta;
      }
      this.emit('feed', n);
    }
    this.push(n);
  } else if ((node['#name'] === 'head' ||
            (node['#local'] === 'head' && (node['#prefix'] === '' || node['#type'] === 'opml'))) &&
            !this.meta.title) { // We haven't yet parsed all the metadata
    utils.merge(this.meta, this.handleMeta(n), true);
    if (!this._emitted_meta) {
      this.emit('meta', this.meta);
      this._emitted_meta = true;
    }
  }

  if (this.stack.length > 0) {
    if (node['#prefix'] && node['#local'] && !node['#type']) {
      stdEl = node['#prefix'] + ':' + node['#local'];
    } else if (node['#name'] && node['#type'] && node['#type'] !== this.meta['#type']) {
      stdEl = node['#name'];
    } else {
      stdEl = node['#local'] || node['#name'];
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
OpmlParser.prototype._transform = function (data, encoding, done) {
  this.stream.write(data);
  done();
};

OpmlParser.prototype._flush = function (done) {
  this.stream.end();
  done();
};

exports = module.exports = OpmlParser;