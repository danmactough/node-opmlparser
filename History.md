
v0.4.1 / 2013-01-07
==================

  * Fix typo: no camelCase when using sax lowercasetags option

v0.4.0 / 2012-12-31
==================

  * Conform to changes in utils.js. Linting
  * Don't modify Object or Array primitives. Rename getValue() to get().
  * Reorganize source code

v0.3.3 / 2012-03-13
==================

  * Version bump to 0.3.0. Shouldn't be breakage, but minor version bump just in case.
  * Update README and inline documentation.
  * Add an 'outline' emitter. Handle errors while parsing. Call _reset on instantiation and in handleEnd. Among other things, this enables more elegant streaming via <parser_instance>.stream.
  * Add a parsed array of categories to each node having a category attribute.
  * Refactor utility functions to separate utils.js file. Refactor meta parsing to handleMeta function. Add all non-namespace attributes to meta['@']. Add folder name to feeds (basic, does not handle nested folders).

v0.2.3 / 2012-01-31
==================

  * Update request. Version bump.

v0.2.2 / 2011-12-07
==================

  * Version bump
  * Fix `meta` where the opml has no `outlines`

v0.2.1 / 2011-11-28
==================

  * Bump request version to 2.2.x

v0.2.0 / 2011-11-12
==================

  * Fix error handling with callbacks. Add `meta` to 'end' event.

v0.1.0 / 2011-11-11
==================

  * Initial commit
