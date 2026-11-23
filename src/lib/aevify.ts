import { Aevify } from "@aevify/node";
import { env } from "./env";

let client: Aevify | null = null;

/** The store's Aevify client: secret key, server side only. */
export function aevify(): Aevify {
  client ??= new Aevify(env.aevifySecretKey(), { baseUrl: env.aevifyUrl() });
  return client;
}

/** Tests only. */
export function setAevifyClient(c: Aevify | null) {
  client = c;
}
