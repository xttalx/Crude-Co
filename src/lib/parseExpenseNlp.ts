export type ParsedExpenseHints = {
  amount?: number;
  categoryCode?: string;
  paymentLabel?: string;
  merchant?: string;
  note?: string;
};

/**
 * Lightweight rule-based parser (no external AI). Swap for an LLM later.
 */
export function parseExpenseNaturalLanguage(raw: string): ParsedExpenseHints {
  const input = raw.trim();
  if (!input) return {};

  const hints: ParsedExpenseHints = {};

  const amountMatch = input.match(
    /(?:\$|€|£)\s*(\d+(?:[.,]\d{1,2})?)|(?:^|\s)(\d+(?:[.,]\d{1,2})?)\s*(?:usd|dollars?|bucks?)?(?:\s|$)/i,
  );
  if (amountMatch) {
    const n = amountMatch[1] ?? amountMatch[2];
    if (n) {
      const amount = Number.parseFloat(n.replace(",", "."));
      if (Number.isFinite(amount) && amount > 0) hints.amount = amount;
    }
  }

  if (
    /\b(lunch|breakfast|dinner|brunch|meal|food|restaurant|cafe|coffee|client dinner|client lunch)\b/i.test(
      input,
    )
  ) {
    hints.categoryCode = "meal";
  } else if (/\b(gas|fuel|gasoline|petrol|shell|bp station|fill[- ]?up)\b/i.test(input)) {
    hints.categoryCode = "gas";
  } else if (
    /\b(travel|flight|uber|lyft|taxi|hotel|airbnb|train|parking|mileage)\b/i.test(input)
  ) {
    hints.categoryCode = "travel";
  } else if (
    /\b(office supply|office supplies|staples|printer|paper|desk|ink)\b/i.test(input)
  ) {
    hints.categoryCode = "office_supply";
  } else if (/\b(office|supplies)\b/i.test(input)) {
    hints.categoryCode = "office_supply";
  } else if (/\b(chair|desk|monitor|equipment)\b/i.test(input)) {
    hints.categoryCode = "office_supply";
  } else if (/\b(tool|drill|hardware store)\b/i.test(input)) {
    hints.categoryCode = "tools";
  } else if (/\b(grocer|grocery|supermarket)\b/i.test(input)) {
    hints.categoryCode = "other";
  } else if (/\b(cloth|shirt|pants|shoes|apparel)\b/i.test(input)) {
    hints.categoryCode = "clothing";
  }

  if (/\bcash\b/i.test(input)) hints.paymentLabel = "Cash";
  else if (/\bvisa\b/i.test(input)) hints.paymentLabel = "Visa";
  else if (/\bmastercard\b|\bmc\b/i.test(input)) hints.paymentLabel = "Mastercard";
  else if (/\bamex\b|\bamerican express\b/i.test(input)) hints.paymentLabel = "Amex";
  else if (/\bdebit\b/i.test(input)) hints.paymentLabel = "Debit card";
  else if (/\bcredit card\b|\bcard\b/i.test(input)) hints.paymentLabel = "Card";

  const merchantGuess = extractMerchant(input);
  if (merchantGuess) hints.merchant = merchantGuess;

  const cleaned = scrubNote(input);
  if (cleaned.length > 0 && cleaned.length <= 280) hints.note = cleaned;

  return hints;
}

function scrubNote(input: string): string {
  return input
    .replace(/\$?\s*[\d.,]+\s*/g, " ")
    .replace(/\b(on|with|via|using|paid)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Pull a plausible merchant token (e.g. Shell, Starbucks) from free text. */
function extractMerchant(input: string): string | undefined {
  const known = [
    "shell",
    "chevron",
    "exxon",
    "starbucks",
    "mcdonalds",
    "subway",
    "uber",
    "lyft",
    "amazon",
    "staples",
    "costco",
    "walmart",
  ];
  const lower = input.toLowerCase();
  for (const k of known) {
    if (lower.includes(k)) {
      return k.charAt(0).toUpperCase() + k.slice(1);
    }
  }
  const cap = input.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/);
  if (cap && !/^(Usd|Visa|Amex)$/i.test(cap[1])) return cap[1];
  return undefined;
}
