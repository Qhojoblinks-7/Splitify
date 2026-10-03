/** @jest-environment node */
const {
  PESEWAS_PER_CEDI,
  toPesewas,
  tryToPesewas,
  formatGHC,
  isPesewas,
  add,
  subtract,
  sum,
  roundHalfUp,
  allocate,
  allocateEven,
  payoutAmount,
  shortfall,
} = require("../services/money");

describe("parse and format", () => {
  it("uses 100 pesewas to a cedi", () => {
    expect(PESEWAS_PER_CEDI).toBe(100);
  });

  it("converts whole cedis", () => {
    expect(toPesewas(300)).toBe(30000);
  });

  it("converts decimal strings exactly", () => {
    expect(toPesewas("100.50")).toBe(10050);
    expect(toPesewas("0.01")).toBe(1);
  });

  it("converts a one-decimal string as a whole number of pesewas", () => {
    expect(toPesewas("100.5")).toBe(10050);
  });

  it("pads a single decimal digit", () => {
    expect(toPesewas("7.5")).toBe(750);
  });

  it("treats a bare decimal point as zero", () => {
    expect(toPesewas("5.")).toBe(500);
  });

  it("does not produce a float artefact for 100.5", () => {
    // 100.5 * 100 === 10050.000000000002 in IEEE-754. The parser must not.
    expect(toPesewas(100.5)).toBe(10050);
  });

  it("truncates nothing: rejects more than two decimal places", () => {
    expect(() => toPesewas("1.005")).toThrow();
  });

  it("rejects a float artefact rather than rounding it silently", () => {
    expect(() => toPesewas(0.1 + 0.2)).toThrow();
  });

  it("rejects negatives", () => {
    expect(() => toPesewas(-1)).toThrow();
  });

  it("rejects non-numeric input", () => {
    expect(() => toPesewas("abc")).toThrow();
    expect(() => toPesewas("")).toThrow();
    expect(() => toPesewas(null)).toThrow();
    expect(() => toPesewas(undefined)).toThrow();
    expect(() => toPesewas(NaN)).toThrow();
    expect(() => toPesewas(Infinity)).toThrow();
  });

  it("rejects a leading sign", () => {
    expect(() => toPesewas("+100")).toThrow();
  });

  it("tolerates whitespace and thousands separators", () => {
    expect(toPesewas(" 1,234.50 ")).toBe(123450);
  });

  it("reports failures instead of throwing", () => {
    const failed = tryToPesewas("abc");
    expect(failed.ok).toBe(false);
    expect(failed.value).toBeNull();
    expect(typeof failed.message).toBe("string");
    expect(tryToPesewas("10").ok).toBe(true);
    expect(tryToPesewas("10").value).toBe(1000);
  });

  it("formats pesewas as grouped cedis with two decimals", () => {
    expect(formatGHC(123450)).toBe("1,234.50");
    expect(formatGHC(750)).toBe("7.50");
    expect(formatGHC(5)).toBe("0.05");
    expect(formatGHC(0)).toBe("0.00");
  });
});

describe("integer guards", () => {
  it("accepts non-negative safe integers", () => {
    expect(isPesewas(0)).toBe(true);
    expect(isPesewas(30000)).toBe(true);
  });

  it("rejects floats, negatives and unsafe integers", () => {
    expect(isPesewas(1.5)).toBe(false);
    expect(isPesewas(-1)).toBe(false);
    expect(isPesewas(Number.MAX_SAFE_INTEGER + 2)).toBe(false);
  });

  it("refuses to add a non-pesewa value", () => {
    expect(() => add(1, 2.5)).toThrow();
    expect(() => add("1", 2)).toThrow();
  });

  it("refuses to subtract below zero", () => {
    expect(() => subtract(100, 200)).toThrow();
  });

  it("adds, subtracts and sums exactly", () => {
    expect(add(10050, 500)).toBe(10550);
    expect(subtract(10550, 500)).toBe(10050);
    expect(sum([10050, 500, 1])).toBe(10551);
    expect(sum([])).toBe(0);
  });
});

describe("roundHalfUp", () => {
  it("rounds to the nearest integer, halves upward", () => {
    expect(roundHalfUp(1, 2)).toBe(1);
    expect(roundHalfUp(3, 2)).toBe(2);
    expect(roundHalfUp(5, 2)).toBe(3);
    expect(roundHalfUp(-1, 2)).toBe(-1);
  });

  it("rounds only at the final step, not the inputs", () => {
    expect(roundHalfUp(3334 * 3 + 1, 3)).toBe(3334);
  });
});

describe("allocate", () => {
  it("splits exactly when the total divides evenly", () => {
    const shares = allocate(30000, 3, ["a", "b", "c"]);
    expect(shares).toEqual({ a: 10000, b: 10000, c: 10000 });
  });

  it("distributes the remainder one pesewa at a time in the given order", () => {
    const shares = allocate(10000, 3, ["a", "b", "c"]);
    expect(shares).toEqual({ a: 3334, b: 3333, c: 3333 });
  });

  it("gives the remainder to the receiver first, so the receiver absorbs it", () => {
    const shares = allocate(10000, 3, ["c", "b", "a"]);
    expect(shares).toEqual({ c: 3334, b: 3333, a: 3333 });
  });

  it("never loses or invents a single pesewa", () => {
    for (let total = 0; total < 200; total += 1) {
      for (let count = 1; count <= 7; count += 1) {
        const keys = Array.from({ length: count }, (_, i) => `m${i}`);
        const shares = allocate(total, count, keys);
        expect(sum(Object.values(shares))).toBe(total);
      }
    }
  });

  it("is deterministic across repeated calls", () => {
    const first = allocate(10001, 6, ["a", "b", "c", "d", "e", "f"]);
    for (let i = 0; i < 25; i += 1) {
      expect(allocate(10001, 6, ["a", "b", "c", "d", "e", "f"])).toEqual(first);
    }
  });

  it("returns no shares for an empty roster", () => {
    expect(allocate(10000, 0, [])).toEqual({});
  });

  it("rejects a count that does not match the number of keys", () => {
    expect(() => allocate(10000, 3, ["a", "b"])).toThrow();
  });

  it("has an index-ordered convenience form", () => {
    expect(allocateEven(10000, 3)).toEqual([3334, 3333, 3333]);
  });
});

describe("payoutAmount", () => {
  it("is the verified total less the disclosed fee", () => {
    expect(payoutAmount(35000, 500)).toBe(34500);
  });

  it("never pays more than was collected", () => {
    expect(payoutAmount(10000, 0)).toBe(10000);
  });

  it("refuses to pay when the fee consumes the pot, rather than paying nothing", () => {
    expect(() => payoutAmount(500, 500)).toThrow();
    expect(() => payoutAmount(500, 900)).toThrow();
  });

  it("refuses a negative fee", () => {
    expect(() => payoutAmount(10000, -100)).toThrow();
  });
});

describe("shortfall", () => {
  it("is zero when the pot is met", () => {
    expect(shortfall(30000, 30000)).toBe(0);
  });

  it("is zero when the pot is exceeded, never negative", () => {
    expect(shortfall(30000, 35000)).toBe(0);
  });

  it("is the gap when the pot is not met", () => {
    expect(shortfall(30000, 20000)).toBe(10000);
  });
});