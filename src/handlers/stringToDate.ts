/**
 * Konversi teks tanggal & jam berbahasa Indonesia menjadi objek Date.
 * Contoh input: "9 Agustus 2026 06:30"
 *
 * Catatan: Date dibuat menggunakan timezone lokal server (local time).
 * Pastikan server berjalan di timezone WIB (Asia/Jakarta), atau sesuaikan
 * secara manual jika server berjalan di timezone lain.
 */

const MONTH_MAP: Record<string, number> = {
  januari: 0,
  jan: 0,
  februari: 1,
  feb: 1,
  maret: 2,
  mar: 2,
  april: 3,
  apr: 3,
  mei: 4,
  juni: 5,
  jun: 5,
  juli: 6,
  jul: 6,
  agustus: 7,
  agu: 7,
  september: 8,
  sep: 8,
  oktober: 9,
  okt: 9,
  november: 10,
  nov: 10,
  desember: 11,
  des: 11,
};

const dateTimeRegex =
  /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})\s+([01]?\d|2[0-3]):([0-5]\d)/i;

/**
 * Parse string tanggal Indonesia menjadi objek Date.
 * Mengembalikan null jika format tidak dikenali atau tanggalnya tidak valid
 * (misal: 31 Februari, atau nama bulan yang tidak ada di MONTH_MAP).
 */
export function stringToDate(deadline: string): Date | null {
  const match = deadline.match(dateTimeRegex);
  if (!match) return null;

  const [, dayStr, monthStr, yearStr, hourStr, minuteStr] = match;

  // Guard eksplisit: kalau tsconfig pakai `noUncheckedIndexedAccess`,
  // TS menganggap tiap elemen hasil destructuring array bisa `undefined`,
  // meski secara runtime regex ini punya 5 capture group wajib.
  if (!dayStr || !monthStr || !yearStr || !hourStr || !minuteStr) return null;

  const month = MONTH_MAP[monthStr.toLowerCase()];
  if (month === undefined) return null;

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  const date = new Date(year, month, day, hour, minute, 0, 0);

  // Validasi ulang komponen tanggal, untuk menangkap kasus seperti
  // "31 Februari" yang otomatis "dibulatkan" ke Maret oleh Date bawaan JS
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute
  ) {
    return null;
  }

  return date;
}
