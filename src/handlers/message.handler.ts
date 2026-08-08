import type { WASocket, BaileysEventMap } from "@whiskeysockets/baileys";
import { stringToDate } from "./stringToDate.js";
import {
  scheduleAt,
  pendingReminders,
  activeReminders,
} from "./reminderScheduler.js";

// Regex ini hanya untuk deteksi kasar "apakah command /ingatkan mengandung
// format tanggal & jam". Parsing sesungguhnya dilakukan oleh stringToDate.
const regexJam =
  /\b\d{1,2}\s+(?:Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember|Jan|Feb|Mar|Apr|Jun|Jul|Agu|Sep|Okt|Nov|Des)\s+\d{4}\s+(?:[01]?\d|2[0-3]):[0-5]\d\b/i;

const COMMAND_PREFIX = "/ingatkan";

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

    // Step 1: command /ingatkan <tanggal> <jam>
    if (chat.startsWith(COMMAND_PREFIX.toLowerCase())) {
      const match = rawMessage.match(regexJam);

      if (!match) {
        await sock.sendMessage(remoteJid, {
          text: `Salah ki formatnya\nBegini contohnya: /ingatkan 10 Agustus 2026 09:00`,
        });
        continue;
      }

      const deadlineText = match[0];
      const targetDate = stringToDate(deadlineText);

      if (!targetDate) {
        await sock.sendMessage(remoteJid, {
          text: `Gagal membaca tanggal/jam. Periksaki kembali format bulan atau tanggalnya di.`,
        });
        continue;
      }

      if (targetDate.getTime() <= Date.now()) {
        await sock.sendMessage(remoteJid, {
          text: `Lewat Mki itu tanggalnya monyet!`,
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
        text: `Oce bos😁, Nanti ku kasi ingat ki kalau tanggal *${deadlineText}* mi!\nKirimi pesan yang mau ku kasi ingatkan ki ingatkan.`,
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

      const task = scheduleAt(async () => {
        try {
          await sock.sendMessage(remoteJid, {
            text: `⏰ *AULICH REMINDER!*\nHalo Bos ${m.pushName || "Bos"}, jangan ki lupa 👇😁\n\n${reminderText}\n\n_dijadwalkan untuk ${pending.deadlineText}_\n*1x ji ku kasi ingat ki!*`,
          });
        } catch (error) {
          console.error("Gagal mengirim pengingat:", error);
        } finally {
          activeReminders.delete(remoteJid);
        }
      }, delayMs);

      activeReminders.set(remoteJid, {
        task,
        targetDate: pending.targetDate,
        message: reminderText,
      });

      await sock.sendMessage(remoteJid, {
        text: `✅ Pengingat berhasil dicatat!\n📅 Waktu: *${pending.deadlineText}*\n📝 Pesan: "${reminderText}"`,
      });
      continue;
    }
  }
}
