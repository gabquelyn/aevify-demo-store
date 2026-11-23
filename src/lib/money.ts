/** tUSD8 has 6 decimals. All arithmetic happens in base units (bigint) to avoid float errors. */

export const DECIMALS = 6;
const SCALE = 10n ** BigInt(DECIMALS);

export function toUnits(amount: string): bigint {
  if (!/^\d+(\.\d{1,6})?$/.test(amount)) throw new Error(`Invalid amount: ${amount}`);
  const [whole, frac = ""] = amount.split(".");
  return BigInt(whole!) * SCALE + BigInt(frac.padEnd(DECIMALS, "0"));
}

/** Base units -> decimal string with at least 2 decimals ("4.5" -> "4.50", "0.375" stays). */
export function fromUnits(units: bigint): string {
  const negative = units < 0n;
  const abs = negative ? -units : units;
  const whole = abs / SCALE;
  let frac = (abs % SCALE).toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

export function sum(amounts: string[]): string {
  return fromUnits(amounts.reduce((total, a) => total + toUnits(a), 0n));
}

export function times(amount: string, quantity: number): string {
  return fromUnits(toUnits(amount) * BigInt(quantity));
}

/** "4.50 tUSD8" */
export function formatTusd(amount: string): string {
  return `${amount} tUSD8`;
}
