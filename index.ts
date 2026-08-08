import { connectToWhatsApp } from "./src/services/whatsapp.service.js";

async function main() {
  try {
    await connectToWhatsApp();
    console.log("Aplikasi bot WhatsApp berhasil dijalankan.");
  } catch (error) {
    console.error("Gagal menjalankan aplikasi:", error);
  }
}

main();
