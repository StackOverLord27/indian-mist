/**
 * Pure helpers for scripts/ensure-indexes.mjs (no database access except where a collection is
 * passed in), so they can be unit tested.
 */

const stable = (value) => JSON.stringify(value, (_k, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v));

/** MongoDB's default name for an index: field_direction joined with "_". */
export const indexName = (key, options = {}) => options.name ?? Object.entries(key).map(([field, dir]) => `${field}_${dir}`).join("_");

const pick = (name, key, o = {}) => ({
  name,
  key,
  unique: !!o.unique,
  sparse: !!o.sparse,
  ...(o.expireAfterSeconds !== undefined && { expireAfterSeconds: o.expireAfterSeconds }),
  ...(o.partialFilterExpression && { partialFilterExpression: o.partialFilterExpression }),
});

/** One entry of mongoose `schema.indexes()` ([fields, options]) as a comparable definition. */
export const normalizeDeclared = ([key, options = {}]) => pick(indexName(key, options), key, options);
/** One entry of the live collection's `indexes()`. */
export const normalizeLive = (ix) => pick(ix.name, ix.key, ix);

const sameKey = (a, b) => stable(a) === stable(b);

/** What differs between a declared and a live index of the same name (empty = identical). */
export function differences(declared, live) {
  const out = [];
  if (!sameKey(declared.key, live.key)) out.push(`key: declared ${stable(declared.key)}, live ${stable(live.key)}`);
  if (declared.unique !== live.unique) out.push(`unique: declared ${declared.unique}, live ${live.unique}`);
  if (declared.sparse !== live.sparse) out.push(`sparse: declared ${declared.sparse}, live ${live.sparse}`);
  if (declared.expireAfterSeconds !== live.expireAfterSeconds) out.push(`expireAfterSeconds: declared ${declared.expireAfterSeconds}, live ${live.expireAfterSeconds}`);
  if (stable(declared.partialFilterExpression ?? null) !== stable(live.partialFilterExpression ?? null)) {
    out.push(`partialFilterExpression: declared ${stable(declared.partialFilterExpression ?? null)}, live ${stable(live.partialFilterExpression ?? null)}`);
  }
  return out;
}

/**
 * Declared indexes against live ones ("_id_" ignored).
 *  - missing:   declared but no live index with that name or key
 *  - different: a live index with that name (or the same key under another name) with other options
 *  - extra:     live but not declared (reported, never touched)
 */
export function compareIndexes(declaredList, liveList) {
  const declared = declaredList.map(normalizeDeclared);
  const live = liveList.map(normalizeLive).filter((ix) => ix.name !== "_id_");
  const missing = [];
  const different = [];
  const matchedLive = new Set();
  for (const d of declared) {
    const l = live.find((x) => x.name === d.name) ?? live.find((x) => sameKey(x.key, d.key));
    if (!l) { missing.push(d); continue; }
    matchedLive.add(l.name);
    const diff = differences(d, l);
    if (l.name !== d.name) diff.unshift(`name: declared ${d.name}, live ${l.name}`);
    if (diff.length) different.push({ declared: d, live: l, differences: diff });
  }
  const extra = live.filter((l) => !matchedLive.has(l.name));
  return { missing, different, extra };
}

/** True when this repair needs a uniqueness check first. */
export const needsUniqueness = (d) => d.unique === true;

/**
 * Values the unique index would reject. Reads only (an aggregation). Respects `sparse` (documents
 * without the field are not in the index) and a partialFilterExpression.
 */
export async function findDuplicates(collection, declared, limit = 20) {
  const fields = Object.keys(declared.key);
  const match = declared.partialFilterExpression
    ? { ...declared.partialFilterExpression }
    : declared.sparse
      ? { $or: fields.map((f) => ({ [f]: { $exists: true } })) }
      : {};
  const groups = await collection
    .aggregate([
      { $match: match },
      { $group: { _id: Object.fromEntries(fields.map((f, i) => [`f${i}`, `$${f}`])), count: { $sum: 1 }, ids: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ])
    .toArray();
  return groups.map((g) => ({
    value: Object.fromEntries(fields.map((f, i) => [f, g._id[`f${i}`]])),
    count: g.count,
    ids: g.ids.slice(0, 5).map(String),
  }));
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
export function hostsOf(uri) {
  const afterScheme = uri.replace(/^mongodb(\+srv)?:\/\//, "");
  const authority = afterScheme.split("/")[0].split("?")[0];
  const hostList = authority.includes("@") ? authority.slice(authority.lastIndexOf("@") + 1) : authority;
  return hostList.split(",").map((h) => h.replace(/:\d+$/, ""));
}
export const isLocalUri = (uri) => !uri.startsWith("mongodb+srv:") && hostsOf(uri).every((h) => LOCAL_HOSTS.has(h));

/** The text a person must type to allow --apply: exactly the database name. */
export const confirmationOk = (typed, databaseName) => typeof typed === "string" && typed.trim() === databaseName;
