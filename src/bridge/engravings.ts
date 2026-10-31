import type { Chunk } from "../shared/model.js";

// RFR's engraving stream is a plugin-global delta, even with force_reload.
// Read a fresh, bounded column instead: reconnects, hiding and removal must
// not depend on another client's hash history. No game state is changed.
export const engravingsLua = `
local x,y,z0,z1=...
x,y,z0,z1=tonumber(x),tonumber(y),tonumber(z0),tonumber(z1)
local result={}
dfhack.with_suspend(function()
if not dfhack.isMapLoaded() then return end
for _,e in ipairs(df.global.world.event.engravings) do
  local p=e.pos
  if p.x>=x and p.x<x+16 and p.y>=y and p.y<y+16 and p.z>=z0 and p.z<z1 and not e.flags.hidden then
    local flags=dfhack.maps.getTileFlags(p)
    if flags and not flags.hidden then
      local mask=0
      for i,name in ipairs({'north','south','west','east','northwest','northeast','southwest','southeast','floor'}) do
        if e.flags[name] then mask=mask+2^(i-1) end
      end
      if mask>0 then table.insert(result,{p.x,p.y,p.z,mask}) end
      if #result>=4096 then break end
    end
  end
end
end)
print('DEEPWATCH_ENGRAVINGS:'..(#result==0 and '[]' or require('json').encode(result,{pretty=false})))
`;

export function parseEngravings(
  output: string,
  x: number,
  y: number,
  z0: number,
  z1: number,
) {
  const line = /DEEPWATCH_ENGRAVINGS:([^\r\n]+)/.exec(output)?.[1];
  if (!line) throw Error("Missing engraving response");
  const data: unknown = JSON.parse(line),
    seen = new Set<string>();
  if (!Array.isArray(data) || data.length > 4096)
    throw Error("Invalid engravings");
  return data.map((v): [number, number, number, number] => {
    if (
      !Array.isArray(v) ||
      v.length !== 4 ||
      !v.every(Number.isSafeInteger) ||
      v[0] < x ||
      v[0] >= x + 16 ||
      v[1] < y ||
      v[1] >= y + 16 ||
      v[2] < z0 ||
      v[2] >= z1 ||
      v[3] < 1 ||
      v[3] > 511 ||
      seen.has(v.slice(0, 3).join(","))
    )
      throw Error("Invalid engraving");
    seen.add(v.slice(0, 3).join(","));
    return v as [number, number, number, number];
  });
}

export function applyEngravings(
  chunks: Chunk[],
  records: [number, number, number, number][],
) {
  const byZ = new Map(chunks.map((c) => [c.z, c]));
  for (const c of chunks) for (const t of c.tiles) delete t.engraving;
  for (const [x, y, z, mask] of records) {
    const c = byZ.get(z);
    if (!c || x < c.x || x >= c.x + 16 || y < c.y || y >= c.y + 16) continue;
    const t = c.tiles[(y - c.y) * 16 + x - c.x];
    if (t.sealed || (!t.smooth && t.material !== 7)) continue;
    const faces =
      t.shape === "floor" ? mask & 256 : t.shape === "wall" ? mask & 255 : 0;
    if (faces) t.engraving = faces;
  }
}
