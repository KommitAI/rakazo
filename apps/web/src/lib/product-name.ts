import { DEFAULT_PRODUCT_NAME } from "@rakazo/core";
import { useEffect, useState } from "react";
import { fetchAuthCapabilities } from "./auth-capabilities";

let known: string | undefined;

/** The deployment's PRODUCT_NAME, from the public capabilities; Rakazo until they load. */
export function useProductName(): string {
  const [name, setName] = useState(known ?? DEFAULT_PRODUCT_NAME);
  useEffect(() => {
    let active = true;
    fetchAuthCapabilities()
      .then((capabilities) => {
        known = capabilities.productName ?? DEFAULT_PRODUCT_NAME;
        if (active) setName(known);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return name;
}
