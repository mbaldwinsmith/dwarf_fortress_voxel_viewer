import { it, expect, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Graphics, parseGraphics } from "../src/bridge/graphics.js";
import { SceneryReader } from "../src/bridge/scenery.js";
import { parseCorpseIdentities } from "../src/bridge/corpse-identity.js";
import { parseServerMessage } from "../src/shared/validation.js";
import type { Chunk, SpriteRef } from "../src/shared/model.js";
const sprite: SpriteRef = {
  asset: "a".repeat(24),
  x: 0,
  y: 0,
  width: 32,
  height: 32,
  pageWidth: 128,
  pageHeight: 128,
};
const chunk = (): Chunk => ({
  x: 0,
  y: 0,
  z: 4,
  tiles: Array.from({ length: 256 }, () => ({
    shape: "floor",
    material: 2,
    name: "Floor",
  })),
});
it("keeps live and dead art separate, including child and caste-specific corpse tiles", () => {
  const parsed = parseGraphics(
    "[CREATURE_GRAPHICS:CAT][DEFAULT:ART:0:0:AS_IS][CORPSE:ART:1:0:AS_IS][CHILD:ART:2:0:AS_IS:CORPSE][CREATURE_CASTE_GRAPHICS:CAT:FEMALE][CORPSE:ART:3:0:AS_IS]",
  );
  expect(parsed.sprites.get("CAT")?.x).toBe(0);
  expect(parsed.sprites.get("CAT:CORPSE")?.x).toBe(1);
  expect(parsed.sprites.get("CAT:CORPSE:CHILD")?.x).toBe(2);
  const g = new Graphics();
  for (const [key, ref] of parsed.sprites)
    g.refs.set(key, { ...sprite, x: ref.x * 32 });
  expect(g.corpse("CAT", "MALE")[0].sprite.x).toBe(32);
  expect(g.corpse("CAT", "MALE", true)[0].sprite.x).toBe(64);
  expect(g.corpse("CAT", "FEMALE")[0].sprite.x).toBe(96);
  expect(g.corpse("CAT", "FEMALE", true)[0].sprite.x).toBe(64);
  expect(g.corpse("UNKNOWN", "MALE")).toEqual([]);
  expect(g.resolve("CAT", "MALE")?.x).toBe(0);
});
it("loads independent layered corpse body parts without live, wrong-caste or child layers", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "deepwatch-corpses-"));
  try {
    const graphics = path.join(
      root,
      "data/vanilla/vanilla_creatures_graphics/graphics",
    );
    await mkdir(path.join(graphics, "images"), { recursive: true });
    await writeFile(path.join(graphics, "images/body.png"), "");
    await writeFile(
      path.join(graphics, "body.txt"),
      "[TILE_PAGE:BODY][FILE:images/body.png][TILE_DIM:32:32][PAGE_DIM:4:4]" +
        "[CREATURE_GRAPHICS:PERSON][LAYER_SET:DEFAULT][LAYER:LIVE:BODY:3:3]" +
        "[LAYER_SET:CORPSE][LAYER:TORSO:BODY:0:0][CONDITION_NOT_CHILD]" +
        "[LAYER:CHILD:BODY:1:0][CONDITION_CHILD][LAYER:HEAD:BODY:0:1][CONDITION_CASTE:MALE]" +
        "[LAYER:HEAD_F:BODY:1:1][CONDITION_CASTE:FEMALE]",
    );
    const g = new Graphics();
    await g.load(root);
    expect(
      g.corpse("PERSON", "MALE").map((l) => [l.sprite.x, l.sprite.y]),
    ).toEqual([
      [0, 0],
      [0, 32],
    ]);
    expect(
      g.corpse("PERSON", "FEMALE", true).map((l) => [l.sprite.x, l.sprite.y]),
    ).toEqual([
      [32, 0],
      [32, 32],
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
it("looks up only visible ground corpses once and preserves layers through item updates", async () => {
  const rpc = {
    call: vi.fn(async (name: string) =>
      name === "GetItemList"
        ? {
            materialList: [
              { matPair: { matType: 23, matIndex: -1 }, id: "CORPSE" },
            ],
          }
        : {},
    ),
    corpseIdentities: vi.fn(async () => [
      { id: 7, race: "CAT", caste: "FEMALE", child: false },
    ]),
  };
  const art = { get: () => sprite },
    g = {
      corpse: vi.fn(() => [
        { sprite },
        {
          sprite: { ...sprite, x: 32 },
          palette: { asset: "b".repeat(24), row: 1, sourceRow: 0 },
        },
      ]),
    };
  const reader = new SceneryReader(
    rpc as never,
    art as never,
    { x: 0, y: 0, z: 0, width: 16, depth: 16, height: 10 },
    g as never,
  );
  await reader.initialize();
  const c = chunk();
  c.tiles[18].shape = "unknown";
  const item = {
    id: 7,
    pos: { x: 1, y: 1, z: 4 },
    flags1: 1,
    type: { matType: 23, matIndex: -1 },
  };
  const blocks = [
    {
      chunk: c,
      items: [
        item,
        { ...item, id: 8, pos: { x: 2, y: 1, z: 4 } },
        { ...item, id: 9, flags1: 1 | (1 << 4) },
      ],
    },
  ];
  await reader.prepareCorpses(blocks);
  await reader.prepareCorpses(blocks);
  expect(rpc.corpseIdentities).toHaveBeenCalledExactlyOnceWith([7]);
  expect(g.corpse).toHaveBeenCalledWith("CAT", "FEMALE", false);
  const result = reader.withItems(c, [item]);
  expect(result.objects?.[0].details).toHaveLength(1);
  expect(() =>
    parseServerMessage({
      type: "chunks",
      session: "s",
      sequence: 1,
      pollMs: 200,
      chunks: [result],
    }),
  ).not.toThrow();
  expect(reader.withItems(result, []).objects).toEqual([]);
  expect(
    reader.withItems(c, [{ ...item, pos: { x: 3, y: 1, z: 4 } }]).objects?.[0],
  ).toMatchObject({ x: 3, details: [{ palette: { row: 1 } }] });
});
it("rejects unsolicited, duplicate and malformed corpse metadata", () => {
  const valid = { id: 7, race: "CAT", caste: "FEMALE", child: false };
  expect(
    parseCorpseIdentities("DEEPWATCH_CORPSES:" + JSON.stringify([valid]), [7]),
  ).toEqual([valid]);
  expect(parseCorpseIdentities("DEEPWATCH_CORPSES:[]", [7])).toEqual([]);
  for (const data of [
    [{ ...valid, id: 8 }],
    [valid, valid],
    [{ ...valid, race: "../CAT" }],
    [{ ...valid, child: 0 }],
    {},
  ])
    expect(() =>
      parseCorpseIdentities(
        "DEEPWATCH_CORPSES:" + JSON.stringify(data),
        [7, 9],
      ),
    ).toThrow();
});
