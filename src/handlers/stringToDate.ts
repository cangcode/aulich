/**
 * Konversi teks tanggal & jam berbahasa Indonesia menjadi objek Date.
 * Contoh input: "9 Agustus 2026 06:30"
 *
 * PENTING: Waktu yang diketik user SELALU dianggap WIB (UTC+7), TIDAK
 * bergantung pada timezone tempat server Node berjalan. Ini untuk
 * menghindari bug di mana server yang jalan di UTC (umum di cloud/Docker)
 * salah menghitung apakah suatu waktu sudah lewat atau belum.
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

// WIB = UTC+7, tidak ada DST di Indonesia, jadi offset ini fixed selamanya.
const WIB_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Parse string tanggal Indonesia (dianggap WIB) menjadi objek Date (instant
 * UTC yang benar & absolut). Mengembalikan null jika format tidak dikenali
 * atau tanggalnya tidak valid (misal: 31 Februari).
 */
export function stringToDate(deadline: string): Date | null {
  const match = deadline.match(dateTimeRegex);
  if (!match) return null;

  const [, dayStr, monthStr, yearStr, hourStr, minuteStr] = match;
  if (!dayStr || !monthStr || !yearStr || !hourStr || !minuteStr) return null;

  const month = MONTH_MAP[monthStr.toLowerCase()];
  if (month === undefined) return null;

  const day = parseInt(dayStr, 10);
  const year = parseInt(yearStr, 10);
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  // Bangun instant dari angka yang diketik user seolah-olah UTC dulu (biar
  // gampang divalidasi tanpa kena pengaruh timezone lokal server).
  const rawUtcMillis = Date.UTC(year, month, day, hour, minute, 0, 0);
  const check = new Date(rawUtcMillis);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== day ||
    check.getUTCHours() !== hour ||
    check.getUTCMinutes() !== minute
  ) {
    return null;
  }

  // Angka yang diketik user itu sebenarnya WIB (UTC+7), bukan UTC. Geser
  // mundur 7 jam supaya dapat instant UTC yang sesungguhnya.
  return new Date(rawUtcMillis - WIB_OFFSET_MS);
}
