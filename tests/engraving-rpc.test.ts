import { it, expect } from "vitest";
import net from "node:net";
import { once } from "node:events";
import { Rpc } from "../src/bridge/rpc.js";
import { Frames, frame } from "../src/bridge/framing.js";
import { type } from "../src/bridge/protocol.js";
import { engravingsLua } from "../src/bridge/engravings.js";
it("sends only the fixed read-only engraving script with bounded column arguments", async () => {
  let calls = 0;
  const server = net.createServer((socket) => {
    let handshake = Buffer.alloc(0),
      ready = false;
    const frames = new Frames();
    socket.on("data", (data) => {
      if (!ready) {
        handshake = Buffer.concat([handshake, data]);
        if (handshake.length < 12) return;
        ready = true;
        const h = Buffer.alloc(12);
        h.write("DFHack!\n");
        h.writeInt32LE(1, 8);
        socket.write(h);
        data = handshake.subarray(12);
      }
      for (const f of frames.push(data)) {
        expect(f.id).toBe(1);
        const t = type("dfproto.CoreRunCommandRequest"),
          v = t.toObject(t.decode(f.body));
        expect(v).toEqual({
          command: "lua",
          arguments: [engravingsLua, "16", "32", "10", "12"],
        });
        calls++;
        const n = type("dfproto.CoreTextNotification");
        socket.write(
          frame(
            -3,
            n
              .encode({
                fragments: [
                  {
                    text: "DEEPWATCH_ENGRAVINGS:[[17,33,10,1],[18,33,11,256]]\n",
                  },
                ],
              })
              .finish(),
          ),
        );
        socket.write(frame(-1));
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const rpc = new Rpc((server.address() as net.AddressInfo).port);
  try {
    await rpc.connect();
    expect(await rpc.engravings(16, 32, 10, 12)).toEqual([
      [17, 33, 10, 1],
      [18, 33, 11, 256],
    ]);
    for (const args of [
      [17, 32, 10, 12],
      [16, 32, 10, 27],
      [16, 32, 12, 10],
      [-16, 32, 10, 12],
    ])
      await expect(
        rpc.engravings(...(args as [number, number, number, number])),
      ).rejects.toThrow("Invalid engraving bounds");
    expect(calls).toBe(1);
  } finally {
    rpc.close();
    server.close();
  }
});
