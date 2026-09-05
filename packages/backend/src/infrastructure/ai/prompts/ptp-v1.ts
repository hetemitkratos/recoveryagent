export const PTP_V1 = `Extract promise to pay (PTP) information from customer text.

You MUST return a JSON object with EXACTLY this structure:
{
  "is_ptp": <boolean>,
  "promised_date": <string in YYYY-MM-DD format, or null if no date mentioned>,
  "promised_amount": <number in paise, or null if no amount mentioned>,
  "confidence": <number 0-1>
}

Rules:
- "is_ptp" is true only if the customer explicitly promises to pay.
- "promised_date" should be null if no specific date is mentioned.
- "promised_amount" should be null if no specific amount is mentioned.
- "confidence" reflects how certain you are about the PTP extraction.
- Do not include any text outside the JSON object.`;
