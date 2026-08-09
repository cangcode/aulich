import type { WASocket, BaileysEventMap } from "@whiskeysockets/baileys";
import { stringToDate } from "./stringToDate.js";
import {
  scheduleAt,
  pendingReminders,
  nextReminderId,
  registerActiveReminder,
  removeActiveReminder,
  getRemindersForChat,
} from "./reminderScheduler.js";

// Regex ini hanya untuk deteksi kasar "apakah command /ingatkan mengandung
// format tanggal & jam". Parsing sesungguhnya dilakukan oleh stringToDate.
const regexJam =
  /\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+\d{4}\s+(?:[01]?\d|2[0-3]):[0-5]\d\b/i;

const COMMAND_PREFIX = "/ingatkan";
const LIST_PREFIXES = ["/listpengingat", "/list"];
const DELETE_PREFIXES = ["/hapuspengingat", "/hapus"];

export async function handleMessagesUpsert(
  sock: WASocket,
  event: BaileysEventMap["messages.upsert"],
): Promise<void> {
  if (event.type !== "notify") return;

  for (const m of event.messages) {
    const rawMessage =
      m.message?.conversation || m.message?.extendedTextMessage?.text || "";
    const chat = rawMessage.toLowerCase().trim();

    if (m.key.fromMe || !m.key.remoteJid) continue;
    const remoteJid = m.key.remoteJid;

    console.log(`[Pesan Masuk] Dari: ${remoteJid}`);

    // Handling sapaan
    if (chat.includes("halo bot")) {
      await sock.sendMessage(remoteJid, {
        text: `Halo juga bos ${m.pushName || "User"}!`,
      });
      continue;
    }

    // /listpengingat atau /list -> tampilkan semua pengingat aktif di chat ini
    if (LIST_PREFIXES.some((p) => chat === p)) {
      const reminders = getRemindersForChat(remoteJid);

      if (reminders.length === 0) {
        await sock.sendMessage(remoteJid, {
          text: `Nda adapi pengingat yang aktif di chat ini bosku.`,
        });
        continue;
      }

      const listText = reminders
        .map((r, i) => `${i + 1}. 📅 ${r.deadlineText}\n   📝 ${r.message}`)
        .join("\n\n");

      await sock.sendMessage(remoteJid, {
        text: `📋 *Daftar Pengingat Aktif*\n\n${listText}\n\nKalo moki hapus i ketik 👇\n/hapuspengingat <nomor>`,
      });
      continue;
    }

    // /hapuspengingat <nomor> atau /hapus <nomor> -> batalkan reminder tertentu
    if (DELETE_PREFIXES.some((p) => chat.startsWith(p))) {
      const parts = rawMessage.trim().split(/\s+/);
      const indexStr = parts[1];
      const index = indexStr ? parseInt(indexStr, 10) : NaN;

      const reminders = getRemindersForChat(remoteJid);
      const target = !isNaN(index) ? reminders[index - 1] : undefined;

      if (!indexStr || isNaN(index) || !target) {
        await sock.sendMessage(remoteJid, {
          text: `Salahki format atau nomor ta ndak ditemukan.\nKetik /listpengingat dulu kalau mauki lihat nomornya,\n baru ketik /hapuspengingat <nomor>.`,
        });
        continue;
      }

      removeActiveReminder(target.id);

      await sock.sendMessage(remoteJid, {
        text: `🗑️ Pengingat *"${target.message}"* (${target.deadlineText}) berhasil dihapus.`,
      });
      continue;
    }

    // Step 1: command /ingatkan <tanggal> <jam>
    if (chat.startsWith(COMMAND_PREFIX.toLowerCase())) {
      const match = rawMessage.match(regexJam);

      if (!match || !match[0]) {
        await sock.sendMessage(remoteJid, {
          text: `Salah ki formatnya.\nBegini contohnya eee: /ingatkan 10 Agustus 2026 09:00`,
        });
        continue;
      }

      const deadlineText = match[0];
      const targetDate = stringToDate(deadlineText);

      if (!targetDate) {
        await sock.sendMessage(remoteJid, {
          text: `Tidak bisa dibaca tanggal/jam yang takirim. periksa dulu kembali perbaiki formatnya bos!`,
        });
        continue;
      }

      if (targetDate.getTime() <= Date.now()) {
        await sock.sendMessage(remoteJid, {
          text: `Lewat mi itu jam/tanggal yang ta kasi kurang ajar!`,
        });
        continue;
      }

      // Simpan state "menunggu isi pesan pengingat" untuk chat ini
      pendingReminders.set(remoteJid, {
        targetDate,
        deadlineText,
        createdAt: Date.now(),
      });

      await sock.sendMessage(remoteJid, {
        text: `Oce Bos😁! nanti ku kasi ingat ki di *${deadlineText}*!\nKirimkan pesan yang mau saya kasi ingatkanki!`,
      });
      continue;
    }

    // Step 2: kalau ada pending reminder, pesan berikut dianggap isi pengingat
    const pending = pendingReminders.get(remoteJid);
    if (pending) {
      pendingReminders.delete(remoteJid);

      const reminderText = rawMessage.trim();
      if (!reminderText) {
        // Pesan kosong (misal cuma gambar tanpa caption) -> minta ulang
        pendingReminders.set(remoteJid, pending);
        await sock.sendMessage(remoteJid, {
          text: `Pesan pengingat tidak boleh kosong. Silakan kirim teks yang ingin diingatkan.`,
        });
        continue;
      }

      const delayMs = pending.targetDate.getTime() - Date.now();
      const reminderId = nextReminderId();

      const task = scheduleAt(async () => {
        try {
          await sock.sendMessage(remoteJid, {
            text: `⏰ *PENGINGAT!*\nHalo ${m.pushName || "Bos"}, ini pengingat untuk Anda:\n\n"${reminderText}"\n\n(dijadwalkan untuk ${pending.deadlineText})`,
          });
        } catch (error) {
          console.error("Gagal mengirim pengingat:", error);
        } finally {
          removeActiveReminder(reminderId);
        }
      }, delayMs);

      registerActiveReminder({
        id: reminderId,
        remoteJid,
        targetDate: pending.targetDate,
        deadlineText: pending.deadlineText,
        message: reminderText,
        task,
      });

      await sock.sendMessage(remoteJid, {
        text: `✅ Okesi bos sudah mi ku catat!\n📅 Waktu: *${pending.deadlineText}*\n📝 Pesan:\n\n${reminderText}\n\nKetik /listpengingat kalau mauki lihat semua pengingat yang aktif.`,
      });
      continue;
    }
  }
}
