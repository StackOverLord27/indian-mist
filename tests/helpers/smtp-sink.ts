import net from "node:net";

/**
 * A tiny SMTP server on 127.0.0.1 for tests (no dependency). It speaks just enough SMTP for
 * nodemailer (plain, with AUTH PLAIN/LOGIN accepted) and records every message's raw bytes.
 *
 * Modes:
 *  - "ok"            accept everything
 *  - "no-greeting"   accept the TCP connection, never send the 220 greeting (hung server)
 *  - "stall-ehlo"    send the greeting, then never answer EHLO (hung after connect)
 *  - "stall-data"    answer everything until DATA, then go silent (hung while sending)
 *  - "reject-rcpt"   answer RCPT TO with 550 that echoes the address (like real providers)
 *  - "drop"          close the socket as soon as it connects
 */
export type SinkMode = "ok" | "no-greeting" | "stall-ehlo" | "stall-data" | "reject-rcpt" | "drop";

export type SinkMessage = { raw: string; mailFrom: string; rcptTo: string[] };

export async function startSmtpSink(initial: SinkMode = "ok") {
  const state = { mode: initial, messages: [] as SinkMessage[], connections: 0 };
  const sockets = new Set<net.Socket>();

  const server = net.createServer((socket) => {
    state.connections++;
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => {});
    if (state.mode === "drop") return void socket.destroy();
    if (state.mode === "no-greeting") return;
    socket.write("220 sink ESMTP\r\n");

    let buffer = "";
    let inData = false;
    let data = "";
    let mailFrom = "";
    let rcpt: string[] = [];

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      for (;;) {
        if (inData) {
          const end = buffer.indexOf("\r\n.\r\n");
          if (end === -1) { data += buffer; buffer = ""; return; }
          data += buffer.slice(0, end);
          buffer = buffer.slice(end + 5);
          inData = false;
          state.messages.push({ raw: data, mailFrom, rcptTo: rcpt });
          data = ""; rcpt = [];
          socket.write("250 queued\r\n");
          continue;
        }
        const nl = buffer.indexOf("\r\n");
        if (nl === -1) return;
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 2);
        const cmd = line.slice(0, 4).toUpperCase();
        if (state.mode === "stall-ehlo" && (cmd === "EHLO" || cmd === "HELO")) return;
        if (cmd === "EHLO") socket.write("250-sink\r\n250 AUTH PLAIN LOGIN\r\n");
        else if (cmd === "HELO") socket.write("250 sink\r\n");
        else if (cmd === "AUTH") socket.write("235 ok\r\n");
        else if (cmd === "MAIL") { mailFrom = line.slice(10).trim(); socket.write("250 ok\r\n"); }
        else if (cmd === "RCPT") {
          const addr = line.slice(8).trim();
          if (state.mode === "reject-rcpt") socket.write(`550 5.1.1 ${addr}: Recipient address rejected\r\n`);
          else { rcpt.push(addr); socket.write("250 ok\r\n"); }
        } else if (cmd === "DATA") {
          if (state.mode === "stall-data") return;
          inData = true;
          socket.write("354 go\r\n");
        } else if (cmd === "QUIT") { socket.write("221 bye\r\n"); socket.end(); }
        else socket.write("250 ok\r\n");
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as net.AddressInfo).port;
  return {
    port,
    state,
    async close() {
      for (const s of sockets) s.destroy();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

/** Header block of a recorded message, unfolded (continuation lines joined). */
export function headersOf(raw: string): string[] {
  const head = raw.split("\r\n\r\n")[0] ?? "";
  return head.replace(/\r\n[ \t]+/g, " ").split("\r\n");
}
