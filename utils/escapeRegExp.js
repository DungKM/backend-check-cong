// Escapes regex metacharacters in user-supplied search text before building a
// RegExp from it — without this, a search query containing patterns like
// "(a+)+$" can cause catastrophic backtracking (ReDoS) and hang the event loop.
function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = { escapeRegExp };
