import type { ConnectionState } from "@whiskeysockets/baileys";
import { DisconnectReason } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcode from "qrcode-terminal";

export function handleConnectionUpdate(
  update: Partial<ConnectionState>,
  reconnectCallback: () => void,
): void {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    console.log("Scan QR code berikut di aplikasi WhatsApp Anda:");
    qrcode.generate(qr, { small: true });
  }

  if (connection === "close") {
    const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
    const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

    console.log(
      "Koneksi terputus karena:",
      lastDisconnect?.error,
      "| Reconnecting:",
      shouldReconnect,
    );

    if (shouldReconnect) {
      reconnectCallback();
    } else {
      console.log(
        "Sesi ter-logout. Silakan hapus folder auth dan scan QR kembali.",
      );
    }
  } else if (connection === "open") {
    console.log("Koneksi WhatsApp berhasil terhubung!");
  }
}
