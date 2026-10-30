import type { SceneryObject } from "../shared/model.js";
import type { FurnitureFace } from "./furniture.js";
import type { WorkshopJob, WorkshopSheet } from "./native-workshop-worker.js";
import {
  hasNativeWorkshop,
  registerNativeWorkshop,
  workshopLayoutKey,
} from "./workshop-models.js";

/** Local vanilla artwork is decoded once; geometry extraction runs off-thread. */
export class NativeWorkshops {
  private worker?: Worker;
  private images = new Map<string, Promise<WorkshopSheet>>();
  private sent = new Set<string>();
  private jobs = new Map<
    number,
    { object: SceneryObject; resolve: (ok: boolean) => void }
  >();
  private pending = new Map<string, Promise<boolean>>();
  private next = 0;
  private disposed = false;
  private image(asset: string) {
    let value = this.images.get(asset);
    if (!value) {
      value = (async () => {
        const image = new Image();
        image.src = `/local-art/${asset}`;
        await image.decode();
        if (this.disposed) throw Error("Workshop loader disposed");
        const canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const context = canvas.getContext("2d", { willReadFrequently: true })!;
        context.drawImage(image, 0, 0);
        return {
          width: image.width,
          height: image.height,
          pixels: context.getImageData(0, 0, image.width, image.height).data,
        };
      })();
      this.images.set(asset, value);
    }
    return value;
  }
  load(o: SceneryObject): Promise<boolean> {
    if (this.disposed || !o.workshop?.art || hasNativeWorkshop(o))
      return Promise.resolve(false);
    const key = workshopLayoutKey(o),
      old = this.pending.get(key);
    if (old) return old;
    const task = this.start(o).catch((error) => {
      if (!this.disposed)
        console.warn(
          "Native workshop unavailable",
          o.workshop!.type,
          String(error),
        );
      return false;
    });
    this.pending.set(key, task);
    // Keep failed requests bounded without retrying on every creature update.
    if (this.pending.size > 96)
      this.pending.delete(this.pending.keys().next().value!);
    return task;
  }
  private async start(object: SceneryObject) {
    const art = object.workshop!.art!,
      sheets: Record<string, WorkshopSheet> = {};
    const assets = new Set([
      art.base.asset,
      ...(art.decor ? [art.decor.asset] : []),
    ]);
    const decoded = await Promise.all(
      [...assets].map(
        async (asset) => [asset, await this.image(asset)] as const,
      ),
    );
    if (this.disposed) return false;
    if (!this.worker) {
      this.worker = new Worker(
        new URL("./native-workshop-worker.ts", import.meta.url),
        { type: "module" },
      );
      this.worker.onmessage = ({
        data,
      }: MessageEvent<{
        id: number;
        faces?: FurnitureFace[];
        error?: string;
      }>) => {
        const job = this.jobs.get(data.id);
        if (!job) return;
        this.jobs.delete(data.id);
        if (data.faces?.length) registerNativeWorkshop(job.object, data.faces);
        if (data.error)
          console.warn("Native workshop extraction failed", data.error);
        job.resolve(!!data.faces?.length);
      };
      this.worker.onerror = () => {
        for (const job of this.jobs.values()) job.resolve(false);
        this.jobs.clear();
        this.worker?.terminate();
        this.worker = undefined;
        this.sent.clear();
      };
    }
    const transfers: ArrayBuffer[] = [];
    for (const [asset, sheet] of decoded)
      if (!this.sent.has(asset)) {
        // Keep the decoded copy available if a worker needs restarting.
        const pixels = new Uint8ClampedArray(sheet.pixels);
        sheets[asset] = { ...sheet, pixels };
        transfers.push(pixels.buffer);
        this.sent.add(asset);
      }
    const id = ++this.next;
    return new Promise<boolean>((resolve) => {
      this.jobs.set(id, { object, resolve });
      this.worker!.postMessage(
        { id, object, sheets } satisfies WorkshopJob,
        transfers,
      );
    });
  }
  dispose() {
    this.disposed = true;
    this.worker?.terminate();
    for (const job of this.jobs.values()) job.resolve(false);
    this.jobs.clear();
    this.images.clear();
    this.pending.clear();
    this.sent.clear();
  }
}
