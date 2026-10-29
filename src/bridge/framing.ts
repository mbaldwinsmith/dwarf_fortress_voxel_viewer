export function frame(id: number, body: Uint8Array = Buffer.alloc(0)): Buffer {
  // Native C++ layout: int16 id, two padding bytes, int32 size (little endian).
  const h = Buffer.alloc(8);
  h.writeInt16LE(id);
  h.writeInt32LE(body.length, 4);
  return Buffer.concat([h, body]);
}
export class Frames {
  private bytes = Buffer.alloc(0);
  push(data: Buffer): { id: number; body: Buffer; code: number }[] {
    this.bytes = Buffer.concat([this.bytes, data]);
    const result = [];
    while (this.bytes.length >= 8) {
      const id = this.bytes.readInt16LE(0),
        size = this.bytes.readInt32LE(4);
      if (id !== -2 && (size < 0 || size > 64 * 1024 * 1024))
        throw Error("Invalid DFHack frame size");
      const length = id === -2 ? 0 : size;
      if (this.bytes.length < 8 + length) break;
      result.push({ id, body: this.bytes.subarray(8, 8 + length), code: size });
      this.bytes = this.bytes.subarray(8 + length);
    }
    return result;
  }
}
