const EMPTY = Buffer.alloc(0);
export function frame(id: number, body: Uint8Array = EMPTY): Buffer {
  const result = Buffer.allocUnsafe(8 + body.length);
  // Native C++ layout: int16 id, two zero padding bytes, int32 size.
  result.writeInt16LE(id, 0);
  result.writeUInt16LE(0, 2);
  result.writeInt32LE(body.length, 4);
  result.set(body, 8);
  return result;
}
export class Frames {
  private buffers: Buffer[] = [];
  private head = 0;
  private offset = 0;
  private available = 0;
  private pending?: { id: number; size: number; length: number };
  private take(length: number): Buffer {
    if (!length) return EMPTY;
    const first = this.buffers[this.head],
      remaining = first.length - this.offset;
    const result =
      remaining >= length
        ? first.subarray(this.offset, this.offset + length)
        : Buffer.allocUnsafe(length);
    let copied = 0;
    while (copied < length) {
      const b = this.buffers[this.head],
        n = Math.min(length - copied, b.length - this.offset);
      if (remaining < length)
        b.copy(result, copied, this.offset, this.offset + n);
      this.offset += n;
      copied += n;
      if (this.offset === b.length) {
        this.buffers[this.head++] = EMPTY;
        this.offset = 0;
      }
    }
    this.available -= length;
    if (this.head === this.buffers.length) {
      this.buffers.length = 0;
      this.head = 0;
    } else if (this.head > 64) {
      this.buffers = this.buffers.slice(this.head);
      this.head = 0;
    }
    return result;
  }
  push(data: Buffer): { id: number; body: Buffer; code: number }[] {
    if (data.length) {
      this.buffers.push(data);
      this.available += data.length;
    }
    const result = [];
    while (true) {
      if (!this.pending) {
        if (this.available < 8) break;
        const header = this.take(8),
          id = header.readInt16LE(0),
          size = header.readInt32LE(4);
        if (id !== -2 && (size < 0 || size > 64 * 1024 * 1024))
          throw Error("Invalid DFHack frame size");
        this.pending = { id, size, length: id === -2 ? 0 : size };
      }
      const { id, size, length } = this.pending;
      if (this.available < length) break;
      result.push({ id, body: this.take(length), code: size });
      this.pending = undefined;
    }
    return result;
  }
}
