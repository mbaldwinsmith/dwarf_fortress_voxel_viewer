import type { ServerMessage } from "../shared/model.js";
import { parseServerMessage } from "../shared/validation.js";
export function connect(
  receive: (m: ServerMessage) => void,
  status: (s: string) => void,
) {
  let socket: WebSocket,
    timer: ReturnType<typeof setTimeout>,
    closed = false;
  function open() {
    socket = new WebSocket(
      `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/live`,
    );
    socket.onmessage = (e) => {
      try {
        receive(parseServerMessage(JSON.parse(String(e.data))));
      } catch (err) {
        status(`Invalid bridge response: ${String(err)}`);
        socket.close();
      }
    };
    socket.onerror = () => status("Cannot reach local companion service");
    socket.onclose = () => {
      if (!closed) {
        status("Companion disconnected · reconnecting…");
        timer = setTimeout(open, 2000);
      }
    };
  }
  open();
  return Object.assign(
    () => {
      closed = true;
      clearTimeout(timer);
      socket.close();
    },
    {
      setMode: (mode: "screen" | "map") => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: "mode", mode }));
      },
      setLevel: (z: number) => {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify({ type: "level", z }));
      },
    },
  );
}
