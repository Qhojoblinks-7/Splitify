/**
 * Money primitives.
 *
 * Every monetary value in Growl is an integer count of pesewas (1 GH¢ = 100 pesewas).
 * Nothing here accepts, stores, or returns a floating point number. That is the whole
 * point of this module: the most common source of money defects in software is a
 * representation defect, and GH¢100.50 stored as a float is not GH¢100.50.
 *
 * Parsing is done from the decimal string rather than by multiplying a number, because
 * `100.5 * 100 === 10050.000000000002` in IEEE-754. Input with more than two decimal
 * places is rejected outright rather than rounded, so a float artefact surfaces as an
 * error instead of quietly becoming a wrong amount.
 *
 * Rule IDs refer to `1791027903-money-handling-and-safeguards.md`.
 *   M1  integer pesewas, never a float        P6  payout = verified − fee
 *   M3  formatting is the only decimal point  C6  shortfall is never negative
 *   M4  reject unparseable input              F6  fees are configuration, not code
 *   M5  round only at the final step          Z4  counted amount ≤ 2 × share
 *   M6  remainder in rotation order
 *   M7  no member shortchanged by rounding
 *
 * Tests: `__tests__/money.test.js` (37). Traceability: `1791028600-traceability-and-status.md` §2.1.
 */

export const PESEWAS_PER_CEDI = 100;

/** Sentinel for "no fee", used where the rail charges nothing. */
export const NO_FEE = 0;

const DECIMAL = /^(\d+)(?:\.(\d{0,2}))?$/;
const DECIMAL_ANY = /^\d+(?:\.\d*)?$/;

export function isPesewas(value) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function assertPesewas(value, label) {
  if (!isPesewas(value)) {
    throw new TypeError(`${label} must be an integer number of pesewas, received ${String(value)}`);
  }
  return value;
}

/**
 * Parses user or provider input into integer pesewas.
 * Throws on anything that is not a non-negative amount with at most two decimals.
 */
export function toPesewas(value) {
  if (typeof value === "boolean") throw new TypeError("A boolean is not an amount");
  if (value === null || value === undefined) throw new TypeError("An amount is required");

  // A finite number is stringified first so `100.5` becomes "100.5" and not a float
  // product. Non-finite values stringify to text that cannot parse, which is the result
  // we want.
  const text = typeof value === "number" ? String(value) : String(value).trim();

  const cleaned = text.replace(/,/g, "");
  if (!DECIMAL_ANY.test(cleaned)) {
    throw new TypeError(`Not a valid amount: ${text}`);
  }

  const match = DECIMAL.exec(cleaned);
  if (!match) {
    throw new TypeError(`Amount has more than two decimal places: ${text}`);
  }

  const [, whole, fraction = ""] = match;
  const padded = fraction.padEnd(2, "0");
  return Number(whole) * PESEWAS_PER_CEDI + Number(padded || 0);
}

/** Form-friendly wrapper: reports the failure instead of throwing. */
export function tryToPesewas(value) {
  try {
    return { ok: true, value: toPesewas(value), message: null };
  } catch (error) {
    return { ok: false, value: null, message: error.message };
  }
}

export function toCedi(pesewas) {
  assertPesewas(pesewas, "pesewas");
  return Math.floor(pesewas / PESEWAS_PER_CEDI);
}

export function formatGHC(pesewas) {
  assertPesewas(pesewas, "pesewas");
  const cedi = Math.floor(pesewas / PESEWAS_PER_CEDI);
  const rest = String(pesewas % PESEWAS_PER_CEDI).padStart(2, "0");
  return `${cedi.toLocaleString("en-US")}.${rest}`;
}

export function add(...values) {
  return values.reduce((total, value) => total + assertPesewas(value, "amount"), 0);
}

export function subtract(minuend, subtrahend) {
  assertPesewas(minuend, "amount");
  assertPesewas(subtrahend, "amount");
  const result = minuend - subtrahend;
  if (result < 0) {
    throw new RangeError(`Refusing to subtract ${subtrahend} from ${minuend}: the result would be negative`);
  }
  return result;
}

export function sum(values) {
  return values.reduce((total, value) => total + assertPesewas(value, "amount"), 0);
}

/** Half-up rounding, applied only at the final step of a calculation. */
export function roundHalfUp(numerator, denominator) {
  if (!Number.isSafeInteger(numerator)) throw new TypeError("numerator must be an integer");
  if (!Number.isSafeInteger(denominator) || denominator === 0) {
    throw new TypeError("denominator must be a non-zero integer");
  }
  const sign = numerator < 0 ? -1 : 1;
  return sign * Math.floor((Math.abs(numerator) + Math.floor(denominator / 2)) / denominator);
}

/**
 * Splits `total` across `keys`, distributing any indivisible remainder one pesewa at a
 * time in the order given.
 *
 * The caller passes rotation order starting at the current receiver, so the member about
 * to be paid absorbs the indivisible cedi. Deterministic and exactly conserving: the
 * returned shares always sum to `total`, for every input.
 */
export function allocate(total, count, keys) {
  assertPesewas(total, "total");
  if (!Number.isSafeInteger(count) || count < 0) throw new TypeError("count must be a non-negative integer");
  if (!Array.isArray(keys) || keys.length !== count) {
    throw new TypeError(`keys must contain exactly ${count} entries`);
  }
  if (count === 0) return {};

  const base = Math.floor(total / count);
  const remainder = total - base * count;

  const shares = {};
  keys.forEach((key, index) => {
    if (Object.prototype.hasOwnProperty.call(shares, key)) {
      throw new TypeError(`Duplicate allocation key: ${key}`);
    }
    shares[key] = base + (index < remainder ? 1 : 0);
  });
  return shares;
}

/** Index-ordered convenience form, for callers with no meaningful key order. */
export function allocateEven(total, count) {
  return Object.values(allocate(total, count, Array.from({ length: count }, (_, i) => i)));
}

/**
 * What the receiver actually receives: everything verified, less the disclosed fee.
 * Refuses rather than paying a non-positive amount, because a round that shows as paid
 * while the receiver got nothing is worse than an escalated block.
 */
export function payoutAmount(verifiedTotal, fee = NO_FEE) {
  assertPesewas(verifiedTotal, "verifiedTotal");
  assertPesewas(fee, "fee");
  const net = verifiedTotal - fee;
  if (net <= 0) {
    throw new RangeError(
      `Refusing to pay ${formatGHC(verifiedTotal)} against a fee of ${formatGHC(fee)}: nothing would reach the receiver`
    );
  }
  return net;
}

/** Never negative. Over-collection is not a shortfall, it is a gift to the receiver. */
export function shortfall(target, verifiedTotal) {
  assertPesewas(target, "target");
  assertPesewas(verifiedTotal, "verifiedTotal");
  return target > verifiedTotal ? target - verifiedTotal : 0;
}

export { DECIMAL, DECIMAL_ANY };