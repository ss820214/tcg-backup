// Saved/public card definitions take precedence over bundled starter fallbacks.
// Resolve starter S/s aliases to that same definition on every battle screen.
export function mergeBattleCardDefinitions(remote, starter, fairy = {}, jewel = {}) {
  const fallback = {};
  for (const [id, def] of Object.entries(starter || {})) {
    const aliases = [id, id.toLowerCase(), id.toUpperCase()];
    const resolved = aliases.map(key => remote[key]).find(Boolean) || def;
    for (const key of aliases) fallback[key] = resolved;
  }
  return { ...fallback, ...remote, ...fairy, ...jewel };
}
