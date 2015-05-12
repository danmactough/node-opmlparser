
v0.8.0 / 2015-05-12
==================

  * Allow arbitrary elements in head

v0.7.0 / 2014-08-01
==================

 * Fix type error: safer deep object properties to guard against malformed input. Resolves #4
 * Add failing test case for #4
 * Always use readable-stream package for stability and updates.

v0.6.0 / 2014-02-12
==================

 * Merge branch 'streams2'
 * Update basic tests.
 * Add tree structure example.
 * Update simple example.
 * Update readme.
 * Update dump script to also dump meta.
 * Remove old debug script.
 * Move category and folder parsing to where the rest of the parsing is.
 * Remove normalize option.
 * Don't emit meta or add meta to data.
 * Update package dependencies
 * Refactor to add outline node ids and parent ids and eliminate unneeded object creation.
 * Don't try to nest children since we're streaming now. Also include meta (unless turned off in options) with all outline elements.
 * Remove unneeded dependencies.
 * Fix params in handleError method.
 * Update supporting files for streams2.
 * First pass porting streams2 changes to main module.

v0.5.0 / 2013-04-06
==================

  * Update travis-ci config
  * Update README
  * Re-resolve xmlbase if necessary. Cleanup.
  * Add naive writable stream api
  * Remove unused OpmlParser#_setCallback() method
  * Update tests
  * Refactor to remove parsing methods from the prototype
  * Enable passing options; refactor initialization
  * Add utility/debugging scripts
  * Change OpmlParser#handleEnd to pass results on `complete` and always emit `end`
  * Return `this` for event handling
  * Add test for category parsing
  * Use utils
  * Use only all-lowercase property names
  * Add travis-ci
  * Add basic mocha tests
  * Stop passing scope; just use this
  * Refactor structure; no code changes
  * Update utils to add reresolve and expose has
  * Fix simple example
  * Merge pull request #1 from russellbeattie/patch-1
  * Update README.md
  * Fix simple example
  * Bump to clean npm registry of stray test file

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
