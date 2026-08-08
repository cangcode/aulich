/**
 * Helper untuk menjadwalkan pengingat menggunakan setTimeout, dengan
 * dukungan delay yang melebihi batas maksimum setTimeout Node.js
 * (2147483647 ms, kira-kira 24.8 hari), dan dukungan pembatalan.
 */

const MAX_TIMEOUT_MS = 2147483647; // 2^31 - 1

export interface ScheduledTask {
  cancel: () => void;
}

export function scheduleAt(
  callback: () => void,
  delayMs: number,
): ScheduledTask {
  let timer: NodeJS.Timeout;
  let cancelled = false;

  const run = (remaining: number) => {
    if (cancelled) return;
    if (remaining > MAX_TIMEOUT_MS) {
      timer = setTimeout(() => run(remaining - MAX_TIMEOUT_MS), MAX_TIMEOUT_MS);
    } else {
      timer = setTimeout(callback, Math.max(remaining, 0));
    }
  };

  run(delayMs);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(timer);
    },
  };
}

/**
 * State "menunggu isi pesan" — dipakai setelah user mengirim command
 * /ingatkan dengan tanggal valid, tapi belum mengirim pesan yang ingin
 * diingatkan.
 */
export interface PendingReminder {
  targetDate: Date;
  deadlineText: string;
  createdAt: number;
}

/**
 * State pengingat yang sudah terjadwal penuh (tanggal + isi pesan).
 * Disimpan supaya bisa dibatalkan nanti (opsional, misal via command /batal).
 */
export interface ActiveReminder {
  task: ScheduledTask;
  targetDate: Date;
  message: string;
}

// Catatan: key memakai remoteJid saja, artinya di grup, state ini per-chat
// bukan per-user. Kalau butuh per-user di dalam grup, ganti key jadi
// `${remoteJid}:${participant}`.
export const pendingReminders = new Map<string, PendingReminder>();
export const activeReminders = new Map<string, ActiveReminder>();
