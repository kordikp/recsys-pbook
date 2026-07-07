// Neutral-path alias for the Recombee proxy. Some ad/privacy blocklists match
// the substring "recombee" even in first-party URLs, 404-ing the API for
// affected readers. Same handler, tracker-free path.
module.exports = require('./recombee.js');
