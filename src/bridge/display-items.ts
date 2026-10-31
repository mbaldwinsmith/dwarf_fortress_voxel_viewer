/** RFR exports contained items but omits the assignment list for displays. */
export const displayItemsLua = `
local ids={...}
local result={}
dfhack.with_suspend(function()
if not dfhack.isMapLoaded() then return end
for _,value in ipairs(ids) do
  local id=tonumber(value)
  local b=id and df.building.find(id)
  if b and df.building_display_furniturest:is_instance(b) then
    local items={}
    for _,itemid in ipairs(b.displayed_items) do
      local item=df.item.find(itemid)
      if item and not item.flags.removed and not item.flags.garbage_collect and
        dfhack.items.getHolderBuilding(item)==b and item.pos.x==b.centerx and
        item.pos.y==b.centery and item.pos.z==b.z then
        table.insert(items,itemid)
        if #items>=8 then break end
      end
    end
    table.insert(result,{id=id,items=items})
  end
end
end)
print('DEEPWATCH_DISPLAYS:'..(#result==0 and '[]' or require('json').encode(result,{pretty=false})))
`;

export function parseDisplayItems(output: string, ids: number[]) {
  const line = /DEEPWATCH_DISPLAYS:([^\r\n]+)/.exec(output)?.[1];
  if (!line) throw Error("Missing display item response");
  const data: unknown = JSON.parse(line),
    allowed = new Set(ids),
    seen = new Set<number>();
  if (!Array.isArray(data) || data.length > ids.length)
    throw Error("Invalid display items");
  return data.map((v): { id: number; items: number[] } => {
    // Lua's JSON encoder represents an empty table as {}.
    const items =
      v &&
      v.items &&
      !Array.isArray(v.items) &&
      Object.keys(v.items).length === 0
        ? []
        : v?.items;
    if (
      !v ||
      !allowed.has(v.id) ||
      seen.has(v.id) ||
      !Array.isArray(items) ||
      items.length > 8 ||
      items.some(
        (id: unknown) => !Number.isSafeInteger(id) || Number(id) < 0,
      ) ||
      new Set(items).size !== items.length
    )
      throw Error("Invalid display item");
    seen.add(v.id);
    return { id: v.id, items };
  });
}
