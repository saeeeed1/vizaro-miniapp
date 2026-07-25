import { TELEGRAM_INIT_DATA_HEADER } from "@/lib/config";

/**
 * Python bot API'siga yuboriladigan header'lar.
 *
 * Brauzerdan kelgan xom `x-telegram-init-data` ni O'ZGARTIRMASDAN uzatadi —
 * imzo faqat xom satr ustidan hisoblanadi, shuning uchun bir belgi ham
 * o'zgarmasligi kerak. Header bo'lmasa hech narsa qo'shilmaydi (Python
 * hozircha uni majburiy qilmaydi).
 */
export function botHeaders(
  incoming: Headers,
  extra?: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...extra };
  const initData = incoming.get(TELEGRAM_INIT_DATA_HEADER);
  if (initData) out[TELEGRAM_INIT_DATA_HEADER] = initData;
  return out;
}
