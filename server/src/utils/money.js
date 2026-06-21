export function centsToYuanText(cents) {
  const safeCents = Number.isFinite(cents) ? cents : 0;
  return `￥${(safeCents / 100).toFixed(1)}`;
}

export function calcCpwCents(priceCents, wearCount) {
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return 0;
  }

  if (!Number.isInteger(wearCount) || wearCount <= 0) {
    return priceCents;
  }

  return Math.round(priceCents / wearCount);
}