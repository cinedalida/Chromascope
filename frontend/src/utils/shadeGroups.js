// Group shade items into product cards and search them.

// Browse: one group per product URL. Recommended: one group per product doc.
function groupKey(item) {
  return item.source === "recommended" ? `recommended:${item.id}` : `browse:${item.url}`;
}

export function groupByProduct(items) {
  const groups = new Map();
  for (const item of items) {
    const key = groupKey(item);
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        source: item.source,
        brand: item.brand,
        product: item.product,
        price: item.price,
        currency: item.currency,
        finish: item.finish,
        url: item.url,
        verdict: item.verdict,
        seasonMatch: item.seasonMatch,
        shades: [],
      });
    }
    groups.get(key).shades.push(item);
  }
  return [...groups.values()];
}

export function searchProducts(groups, query) {
  const q = String(query ?? "").trim().toLowerCase();
  if (!q) return groups;
  const has = (text) => String(text ?? "").toLowerCase().includes(q);
  return groups.filter(
    (group) => has(group.brand) || has(group.product) || group.shades.some((shade) => has(shade.shade)),
  );
}
