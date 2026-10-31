import net from "node:net";
import { Frames, frame } from "./framing.js";
import { methods, type, type Method } from "./protocol.js";
import { miningLua } from "./mining-lua.js";
import { corpseIdentityLua, parseCorpseIdentities } from "./corpse-identity.js";
import { displayItemsLua, parseDisplayItems } from "./display-items.js";
import { engravingsLua, parseEngravings } from "./engravings.js";
export class Rpc {
  private socket: net.Socket;
  private frames = new Frames();
  private hand = Buffer.alloc(0);
  private ready = false;
  private busy = false;
  private pending?: {
    resolve: (b: Buffer) => void;
    reject: (e: Error) => void;
  };
  private ids = new Map<Method, number>();
  private miningText?: string[];
  constructor(port: number) {
    this.socket = net.createConnection({ host: "127.0.0.1", port });
    this.socket.on("error", (e) => this.fail(e));
    this.socket.on("close", () => this.fail(Error("DFHack disconnected")));
    this.socket.on("data", (data) => {
      try {
        if (!this.ready) {
          this.hand = Buffer.concat([this.hand, data]);
          if (this.hand.length < 12) return;
          if (
            this.hand.subarray(0, 8).toString() !== "DFHack!\n" ||
            this.hand.readInt32LE(8) !== 1
          )
            throw Error("Unsupported DFHack handshake");
          data = this.hand.subarray(12);
          this.hand = Buffer.alloc(0);
          this.ready = true;
          this.pending?.resolve(Buffer.alloc(0));
          this.pending = undefined;
        }
        for (const f of this.frames.push(data)) {
          if (f.id === -3) {
            if (this.miningText) {
              const notification = type("dfproto.CoreTextNotification");
              const fragments = notification.toObject(
                notification.decode(f.body),
              ).fragments as { text: string }[] | undefined;
              if (this.miningText.join("").length < 262144)
                this.miningText.push(...(fragments ?? []).map((p) => p.text));
            }
            continue;
          }
          const p = this.pending;
          if (!p) throw Error("Unexpected RPC reply");
          this.pending = undefined;
          if (f.id === -1) p.resolve(f.body);
          else p.reject(Error(`DFHack RPC failure ${f.code}`));
        }
      } catch (e) {
        this.fail(e instanceof Error ? e : Error(String(e)));
        this.close();
      }
    });
  }
  private fail(e: Error) {
    this.pending?.reject(e);
    this.pending = undefined;
  }
  private async wait(send: () => void): Promise<Buffer> {
    if (this.busy) throw Error("Concurrent DFHack requests forbidden");
    this.busy = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await new Promise<Buffer>((resolve, reject) => {
        this.pending = { resolve, reject };
        timer = setTimeout(() => {
          this.fail(Error("DFHack request timeout"));
          this.close();
        }, 5000);
        send();
      });
    } finally {
      clearTimeout(timer);
      this.busy = false;
    }
  }
  async connect() {
    await this.wait(() => {
      const h = Buffer.alloc(12);
      h.write("DFHack?\n");
      h.writeInt32LE(1, 8);
      this.socket.write(h);
    });
  }
  async call(
    name: Method,
    input: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const [i, o] = methods[name];
    let id = this.ids.get(name);
    if (id === undefined) {
      const bind = type("dfproto.CoreBindRequest");
      const reply = await this.wait(() =>
        this.socket.write(
          frame(
            0,
            bind
              .encode(
                bind.create({
                  method: name,
                  inputMsg: i,
                  outputMsg: o,
                  plugin: "RemoteFortressReader",
                }),
              )
              .finish(),
          ),
        ),
      );
      const decoded = type("dfproto.CoreBindReply").decode(reply);
      id = Number(type("dfproto.CoreBindReply").toObject(decoded).assignedId);
      if (!Number.isInteger(id) || id < 2 || id > 32767)
        throw Error("Invalid bound method id");
      this.ids.set(name, id);
    }
    const request = type(i),
      requestId = id;
    const result = await this.wait(() =>
      this.socket.write(
        frame(requestId, request.encode(request.create(input)).finish()),
      ),
    );
    const output = type(o);
    return output.toObject(output.decode(result));
  }
  close() {
    this.socket.destroy();
  }
  async corpseIdentities(ids: number[]) {
    if (
      ids.length > 512 ||
      ids.some((id) => !Number.isSafeInteger(id) || id < 0)
    )
      throw Error("Invalid corpse item IDs");
    if (!ids.length) return [];
    if (this.busy) throw Error("Concurrent DFHack requests forbidden");
    this.miningText = [];
    try {
      const request = type("dfproto.CoreRunCommandRequest");
      await this.wait(() =>
        this.socket.write(
          frame(
            1,
            request
              .encode({
                command: "lua",
                arguments: [corpseIdentityLua, ...ids.map(String)],
              })
              .finish(),
          ),
        ),
      );
      return parseCorpseIdentities(this.miningText.join(""), ids);
    } finally {
      this.miningText = undefined;
    }
  }
  async displayItems(ids: number[]) {
    if (
      ids.length > 64 ||
      ids.some((id) => !Number.isSafeInteger(id) || id < 0)
    )
      throw Error("Invalid display building IDs");
    if (!ids.length) return [];
    if (this.busy) throw Error("Concurrent DFHack requests forbidden");
    this.miningText = [];
    try {
      const request = type("dfproto.CoreRunCommandRequest");
      await this.wait(() =>
        this.socket.write(
          frame(
            1,
            request
              .encode({
                command: "lua",
                arguments: [displayItemsLua, ...ids.map(String)],
              })
              .finish(),
          ),
        ),
      );
      return parseDisplayItems(this.miningText.join(""), ids);
    } finally {
      this.miningText = undefined;
    }
  }
  async engravings(x: number, y: number, z0: number, z1: number) {
    if (
      ![x, y, z0, z1].every(
        (v) => Number.isSafeInteger(v) && v >= 0 && v < 1000000,
      ) ||
      x % 16 ||
      y % 16 ||
      z1 <= z0 ||
      z1 - z0 > 16
    )
      throw Error("Invalid engraving bounds");
    if (this.busy) throw Error("Concurrent DFHack requests forbidden");
    this.miningText = [];
    try {
      const request = type("dfproto.CoreRunCommandRequest");
      await this.wait(() =>
        this.socket.write(
          frame(
            1,
            request
              .encode({
                command: "lua",
                arguments: [engravingsLua, ...[x, y, z0, z1].map(String)],
              })
              .finish(),
          ),
        ),
      );
      return parseEngravings(this.miningText.join(""), x, y, z0, z1);
    } finally {
      this.miningText = undefined;
    }
  }
  async mining(
    args: string[],
  ): Promise<{ state: "READY" | "DUG" | "DESIGNATED"; tiletype: number }> {
    if (this.busy) throw Error("Concurrent DFHack requests forbidden");
    this.miningText = [];
    try {
      const request = type("dfproto.CoreRunCommandRequest");
      await this.wait(() =>
        this.socket.write(
          frame(
            1,
            request
              .encode({ command: "lua", arguments: [miningLua, ...args] })
              .finish(),
          ),
        ),
      );
      const output = this.miningText.join("");
      const success = /DEEPWATCH_MINING:(READY|DUG|DESIGNATED):(\d+)/.exec(
        output,
      );
      if (success)
        return {
          state: success[1] as "READY" | "DUG" | "DESIGNATED",
          tiletype: Number(success[2]),
        };
      throw Error(
        /DEEPWATCH_MINING:ERROR:([^\r\n]+)/.exec(output)?.[1] ??
          "DFHack could not complete the mining action",
      );
    } finally {
      this.miningText = undefined;
    }
  }
}
