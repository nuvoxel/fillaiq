/**
 * Affiliate link generation for product reseller links.
 *
 * Set AMAZON_AFFILIATE_TAG in .env.local to enable Amazon affiliate revenue.
 * Example: AMAZON_AFFILIATE_TAG=fillaiq-20
 */

const AMAZON_TAG = process.env.AMAZON_AFFILIATE_TAG || "";

export function amazonAffiliateUrl(asin: string): string {
  const base = `https://www.amazon.com/dp/${asin}`;
  return AMAZON_TAG ? `${base}?tag=${AMAZON_TAG}` : base;
}

export function amazonSearchUrl(query: string): string {
  const encoded = encodeURIComponent(query);
  const base = `https://www.amazon.com/s?k=${encoded}`;
  return AMAZON_TAG ? `${base}&tag=${AMAZON_TAG}` : base;
}

/**
 * Generate an affiliate URL for a given reseller.
 * Falls back to the raw URL if no affiliate program is configured.
 */
export function affiliateUrl(reseller: string, rawUrl: string): string {
  // Amazon: append tag if configured
  if (reseller === "amazon" && AMAZON_TAG) {
    const url = new URL(rawUrl);
    url.searchParams.set("tag", AMAZON_TAG);
    return url.toString();
  }

  // Future: AliExpress, ShareASale, etc.
  return rawUrl;
}

/** Reseller display info */
export const RESELLER_INFO: Record<string, { name: string; icon: string; color: string }> = {
  amazon: { name: "Amazon", icon: "🛒", color: "#FF9900" },
  aliexpress: { name: "AliExpress", icon: "🛍️", color: "#E62E2E" },
  mcmaster: { name: "McMaster-Carr", icon: "🔩", color: "#004F2D" },
  digikey: { name: "DigiKey", icon: "⚡", color: "#CC0000" },
  mouser: { name: "Mouser", icon: "⚡", color: "#004B87" },
  adafruit: { name: "Adafruit", icon: "🔧", color: "#000000" },
  sparkfun: { name: "SparkFun", icon: "⚡", color: "#E62E04" },
  manufacturer: { name: "Manufacturer", icon: "🏭", color: "#333333" },
  other: { name: "Other", icon: "🔗", color: "#666666" },
};
