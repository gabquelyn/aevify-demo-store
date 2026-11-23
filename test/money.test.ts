import { describe, expect, it } from "vitest";
import { fromUnits, sum, times, toUnits } from "@/lib/money";

describe("money", () => {
  it("converts tUSD8 amounts without float errors", () => {
    expect(toUnits("4.50")).toBe(4_500_000n);
    expect(fromUnits(4_500_000n)).toBe("4.50");
    expect(fromUnits(375_000n)).toBe("0.375");
    expect(sum(["0.10", "0.20"])).toBe("0.30");
    expect(times("4.50", 3)).toBe("13.50");
  });
  it("rejects malformed amounts", () => {
    expect(() => toUnits("1.2345678")).toThrow();
    expect(() => toUnits("-1")).toThrow();
    expect(() => toUnits("abc")).toThrow();
  });
});
