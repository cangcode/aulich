/**
 * Helper untuk menjadwalkan pengingat menggunakan setTimeout, dengan
 * dukungan delay yang melebihi batas maksimum setTimeout Node.js
 * (2147483647 ms, kira-kira 24.8 hari), dan dukungan pembatalan.
 *
 * File ini juga menyimpan state pengingat (pending & aktif) supaya bisa
 * dipakai untuk fitur /listpengingat dan /hapuspengingat.
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
 * diingatkan. Satu chat cuma bisa punya 1 pending state di satu waktu.
 */
export interface PendingReminder {
  targetDate: Date;
  deadlineText: string;
  createdAt: number;
}

// key: remoteJid
export const pendingReminders = new Map<string, PendingReminder>();

/**
 * Pengingat yang sudah terjadwal penuh (tanggal + isi pesan). Satu chat bisa
 * punya banyak ActiveReminder sekaligus, makanya di-key pakai id unik,
 * bukan remoteJid.
 */
export interface ActiveReminder {
  id: number;
  remoteJid: string;
  targetDate: Date;
  deadlineText: string;
  message: string;
  task: ScheduledTask;
}

// key: id unik reminder (bukan remoteJid, karena 1 chat bisa punya banyak reminder)
export const activeReminders = new Map<number, ActiveReminder>();

let reminderIdCounter = 1;

/** Ambil id unik baru untuk reminder yang mau dijadwalkan. */
export function nextReminderId(): number {
  return reminderIdCounter++;
}

/** Simpan reminder yang sudah lengkap (id + task) ke dalam state aktif. */
export function registerActiveReminder(reminder: ActiveReminder): void {
  activeReminders.set(reminder.id, reminder);
}

/** Batalkan timer & hapus reminder dari state aktif. */
export function removeActiveReminder(id: number): ActiveReminder | undefined {
  const reminder = activeReminders.get(id);
  if (!reminder) return undefined;
  reminder.task.cancel();
  activeReminders.delete(id);
  return reminder;
}

/** Ambil semua reminder aktif untuk 1 chat, diurutkan dari yang paling dekat. */
export function getRemindersForChat(remoteJid: string): ActiveReminder[] {
  return Array.from(activeReminders.values())
    .filter((r) => r.remoteJid === remoteJid)
    .sort((a, b) => a.targetDate.getTime() - b.targetDate.getTime());
}
