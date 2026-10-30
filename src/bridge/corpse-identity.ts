export interface CorpseIdentity {
  id: number;
  race: string;
  caste: string;
  child: boolean;
}
// Fixed, read-only lookup: only explicit item IDs, never a scan or a game mutation.
export const corpseIdentityLua = `
local ids={...}
local result={}
dfhack.with_suspend(function()
if not dfhack.isMapLoaded() then return end
for _,value in ipairs(ids) do
  local id=tonumber(value)
  local item=id and df.item.find(id)
  if item and df.item_corpsest:is_instance(item) then
    local raw=df.global.world.raws.creatures.all[item.race]
    local caste=raw and raw.caste[item.caste]
    if raw and caste then
      local age=math.max(0,item.death_year-item.birth_year)
      local child=(caste.flags.HAS_CHILDSTATE and age < caste.misc.child_age) or
        (caste.flags.HAS_BABYSTATE and age < caste.misc.baby_age) or false
      table.insert(result,{id=id,race=raw.creature_id,caste=caste.caste_id,child=child})
    end
  end
end
end)
print('DEEPWATCH_CORPSES:'..(#result==0 and '[]' or require('json').encode(result,{pretty=false})))
`;
export function parseCorpseIdentities(
  output: string,
  ids: number[],
): CorpseIdentity[] {
  const line = /DEEPWATCH_CORPSES:([^\r\n]+)/.exec(output)?.[1];
  if (!line) throw Error("Missing corpse identity response");
  const data: unknown = JSON.parse(line);
  const allowed = new Set(ids);
  if (!Array.isArray(data) || data.length > ids.length)
    throw Error("Invalid corpse identities");
  const seen = new Set<number>();
  return data.map((v) => {
    if (
      !v ||
      !allowed.has(v.id) ||
      seen.has(v.id) ||
      typeof v.race !== "string" ||
      !/^[A-Z0-9_]{1,120}$/.test(v.race) ||
      typeof v.caste !== "string" ||
      !/^[A-Z0-9_]{1,120}$/.test(v.caste) ||
      typeof v.child !== "boolean"
    )
      throw Error("Invalid corpse identity");
    seen.add(v.id);
    return { id: v.id, race: v.race, caste: v.caste, child: v.child };
  });
}
