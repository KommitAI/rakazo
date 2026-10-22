export const DEFAULT_PRODUCT_NAME = "Rakazo";

const PRODUCT_NAME_MAX_LENGTH = 40;

/** The name a self-hosted deployment shows to people; PRODUCT_NAME, else Rakazo. */
export function productNameFromEnv(raw: string | undefined): string {
  const name = raw?.trim();
  if (!name || name.length > PRODUCT_NAME_MAX_LENGTH) return DEFAULT_PRODUCT_NAME;
  return name;
}
