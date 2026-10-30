// Fixed source only. Tile coordinates, save identity and operation arrive as
// separate Lua arguments, never interpolated/executed as client-provided code.
export const miningLua = `
local parameters={...}
dfhack.with_suspend(function()
local x,y,z,operation,mode,save,dry,expected = table.unpack(parameters)
x,y,z,expected=tonumber(x),tonumber(y),tonumber(z),tonumber(expected)
local function result(s) print('DEEPWATCH_MINING:'..s) end
local function reject(s) result('ERROR:'..s) end
if not dfhack.isMapLoaded() or not dfhack.world.isFortressMode() then reject('Load a fortress first'); return end
if df.global.world.cur_savegame.save_dir ~= save then reject('Fortress changed'); return end
local sx,sy,sz=dfhack.maps.getTileSize()
if not x or not y or not z or x%1~=0 or y%1~=0 or z%1~=0 or x<1 or y<1 or z<1 or x>=sx-1 or y>=sy-1 or z>=sz-1 then reject('Tile outside editable map'); return end
if operation~='mine' and operation~='channel' and operation~='ceiling' then reject('Invalid operation');return end
if mode~='dig' and mode~='designate' then reject('Invalid mode');return end
local block=dfhack.maps.getTileBlock(x,y,z)
if not block then reject('Tile not allocated');return end
local lx,ly=x%16,y%16
local flags=block.designation[lx][ly]
local tile=block.tiletype[lx][ly]
local attrs=df.tiletype.attrs[tile]
local material=df.tiletype_material[attrs.material]
local shape=df.tiletype_shape[attrs.shape]
if flags.hidden then reject('Undiscovered tile');return end
if expected and tile~=expected then reject('Tile changed; select it again');return end
if material=='CONSTRUCTION' or material=='TREE' or material=='ROOT' or material=='MUSHROOM' or material=='PLANT' then reject('Use natural stone or soil');return end
if block.occupancy[lx][ly].building~=0 then reject('A building occupies this tile');return end
if operation=='mine' and shape~='WALL' and shape~='FORTIFICATION' then reject('Select a wall to mine');return end
if operation~='mine' and shape~='WALL' and shape~='FLOOR' and shape~='BOULDER' and shape~='PEBBLES' and shape~='BROOK_BED' and shape~='BROOK_TOP' and shape~='RAMP' and shape~='STAIR_UP' and shape~='STAIR_DOWN' and shape~='STAIR_UPDOWN' and shape~='FORTIFICATION' then reject('This tile cannot be channeled');return end
local designated=block.flags.designated
local digPlugin
if mode=='dig' then
  local loaded,p=pcall(require,'plugins.dig-now')
  if not loaded or type(p.dig_now_tile)~='function' then reject('Instant digging is unavailable');return end
  digPlugin=p
end
if dry=='true' then result('READY:'..tile);return end
local old=flags.dig
local dig=operation=='mine' and df.tile_dig_designation.Default or df.tile_dig_designation.Channel
if old~=df.tile_dig_designation.No and old~=dig then reject('A different designation already exists');return end
flags.dig=dig
block.flags.designated=true
if mode=='designate' then
  local ok=pcall(dfhack.job.checkDesignationsNow)
  if not ok then flags.dig=old;block.flags.designated=true;reject('Designation failed');return end
  result('DESIGNATED:'..tile);return
end
local ok,err=pcall(function() digPlugin.dig_now_tile(x,y,z) end)
if not ok then flags.dig=old;block.flags.designated=true;reject('Dig failed');return end
if block.tiletype[lx][ly]==tile then flags.dig=old;block.flags.designated=true;reject('Tile could not be dug');return end
result('DUG:'..tile)
end)
`;
