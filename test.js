const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
    const sock = makeWASocket({ auth: state });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Connessione a WhatsApp riuscita!");

            // ✅ Invio messaggio
            const numero = "393480703306"; // <-- Sostituisci con numero reale
            const jid = numero + "@s.whatsapp.net";
            const result = await sock.sendMessage(jid, { text: "Ciao! Messaggio inviato da Baileys 😎" });

            console.log("📤 Messaggio inviato:", result.key.id);
        }

        if (connection === "close") {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log("❌ Connessione chiusa. Riconnessione:", shouldReconnect);
            if (shouldReconnect) {
                start();
            }
        }
    });
}

start();
