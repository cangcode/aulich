import type { SocketConfig } from "@whiskeysockets/baileys";

export const AUTH_FOLDER = "auth_info_baileys";

export const DEFAULT_SOCKET_CONFIG: Partial<SocketConfig> = {
  printQRInTerminal: false, // Menggunakan qrcode-terminal kustom di connection handler
};
