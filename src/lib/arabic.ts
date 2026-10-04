/** Folds Arabic spelling variants so a search for «الامل» finds «الأمل», «مدرسه» finds «مدرسة», and so on. */
export function normalizeArabic(s: string) {
  return s
    .toLowerCase()
    .replace(/[ً-ْـ]/g, "")
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesArabic(text: string, query: string) {
  const q = normalizeArabic(query);
  return !q || normalizeArabic(text).includes(q);
}
