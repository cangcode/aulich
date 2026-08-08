import makeWASocket, { useMultiFileAuthState } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import {
  AUTH_FOLDER,
  DEFAULT_SOCKET_CONFIG,
} from "../config/whatsapp.config.js";
import { handleConnectionUpdate } from "../handlers/connection.handler.js";
import { handleMessagesUpsert } from "../handlers/message.handler.js";

export async function connectToWhatsApp(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

  const sock = makeWASocket({
    ...DEFAULT_SOCKET_CONFIG,
    auth: state,
  });

  // Event: Pembaruan Kredensial
  sock.ev.on("creds.update", saveCreds);

  // Event: Pembaruan Koneksi
  sock.ev.on("connection.update", (update) =>
    handleConnectionUpdate(update, () => connectToWhatsApp()),
  );

  // Event: Pesan Masuk
  sock.ev.on("messages.upsert", (event) => handleMessagesUpsert(sock, event));

  return sock;
}
