import { it, expect } from "vitest";
import net from "node:net";
import { once } from "node:events";
import { Rpc } from "../src/bridge/rpc.js";
import { Frames, frame } from "../src/bridge/framing.js";
import { type } from "../src/bridge/protocol.js";
import { publicFile } from "../src/bridge/public-files.js";
import { tokens } from "../src/bridge/installation.js";
import { parseServerMessage } from "../src/shared/validation.js";
it("binds exact protobuf names and handles fragmented handshake/text/result", async () => {
  const server = net.createServer((socket) => {
    let handshake = Buffer.alloc(0),
      ready = false;
    const frames = new Frames();
    socket.on("data", (data) => {
      if (!ready) {
        handshake = Buffer.concat([handshake, data]);
        if (handshake.length < 12) return;
        expect(handshake.subarray(0, 8).toString()).toBe("DFHack?\n");
        expect(handshake.readInt32LE(8)).toBe(1);
        ready = true;
        const h = Buffer.alloc(12);
        h.write("DFHack!\n");
        h.writeInt32LE(1, 8);
        socket.write(h.subarray(0, 3));
        socket.write(h.subarray(3));
        data = handshake.subarray(12);
      }
      for (const f of frames.push(data)) {
        if (f.id === 0) {
          const request = type("dfproto.CoreBindRequest").toObject(
            type("dfproto.CoreBindRequest").decode(f.body),
          );
          expect(request).toMatchObject({
            method: "GetVersionInfo",
            plugin: "RemoteFortressReader",
            inputMsg: "dfproto.EmptyMessage",
            outputMsg: "RemoteFortressReader.VersionInfo",
          });
          socket.write(
            frame(
              -1,
              type("dfproto.CoreBindReply").encode({ assignedId: 12 }).finish(),
            ),
          );
        } else {
          expect(f.id).toBe(12);
          socket.write(
            Buffer.concat([
              frame(-3),
              frame(
                -1,
                type("RemoteFortressReader.VersionInfo")
                  .encode({ dwarfFortressVersion: "53.16" })
                  .finish(),
              ),
            ]),
          );
        }
      }
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = (server.address() as net.AddressInfo).port,
    rpc = new Rpc(port);
  try {
    await rpc.connect();
    expect(await rpc.call("GetVersionInfo")).toMatchObject({
      dwarfFortressVersion: "53.16",
    });
  } finally {
    rpc.close();
    server.close();
  }
});
it("rejects unapproved public paths and encoded traversal", () => {
  for (const p of [
    "/../.env",
    "/%2e%2e/.env",
    "/assets/../../save/world.dat",
    "/assets/a\\b.js",
    "/C:/Windows/win.ini",
    "/.env",
    "/src/bridge/server.ts",
  ])
    expect(publicFile("C:/site", p)).toBeUndefined();
  expect(publicFile("C:/site", "/assets/index-123.js")).toContain(
    "index-123.js",
  );
});
it("parses repeated definition metadata without inventing active load order", () => {
  const p = tokens("[ID:example]\n[NAME:A mod]\n[FILE:one]\n[FILE:two]");
  expect(p.get("ID")).toEqual(["example"]);
  expect(p.get("FILE")).toEqual(["one", "two"]);
});
it("rejects malformed/unbounded viewer payloads", () => {
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "s",
      sequence: 1,
      pollMs: 1,
      chunks: [{ x: 0, y: 0, z: 0, tiles: [] }],
    }),
  ).toThrow();
  expect(() =>
    parseServerMessage({
      type: "reset",
      session: "s",
      world: "World",
      bounds: { x: 0, y: 0, z: 0, width: 100000, depth: 1, height: 1 },
    }),
  ).toThrow();
  expect(
    parseServerMessage({ type: "status", message: "Disconnected" }).type,
  ).toBe("status");
});
