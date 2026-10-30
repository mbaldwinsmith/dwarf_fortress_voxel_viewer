// Fixed source only. Tile coordinates, save identity and operation arrive as
// separate Lua arguments, never interpolated/executed as client-provided code.
export const miningLua = `
local parameters={...}
dfhack.with_suspend(function()
local x,y,z,operation,mode,save,dry,expected,x2,y2 = table.unpack(parameters)
x,y,z,expected=tonumber(x),tonumber(y),tonumber(z),tonumber(expected)
local function result(s) print('DEEPWATCH_MINING:'..s) end
local function reject(s) result('ERROR:'..s) end
if not dfhack.isMapLoaded() or not dfhack.world.isFortressMode() then reject('Load a fortress first'); return end
if df.global.world.cur_savegame.save_dir ~= save then reject('Fortress changed'); return end
local sx,sy,sz=dfhack.maps.getTileSize()
if not x or not y or not z or x%1~=0 or y%1~=0 or z%1~=0 or x<1 or y<1 or z<1 or x>=sx-1 or y>=sy-1 or z>=sz-1 then reject('Tile outside editable map'); return end
if operation~='mine' and operation~='channel' and operation~='ceiling' then reject('Invalid operation');return end
if mode~='dig' and mode~='designate' then reject('Invalid mode');return end
if x2 or y2 then
  x2,y2=tonumber(x2),tonumber(y2)
  if mode~='designate' or not x2 or not y2 or x2%1~=0 or y2%1~=0 or x2<0 or y2<0 or x2>=sx or y2>=sy then reject('Invalid designation rectangle');return end
  local width,depth=math.abs(x2-x)+1,math.abs(y2-y)+1
  if width>64 or depth>64 or width*depth>1024 then reject('Designation rectangle exceeds 1024 tiles');return end
  local entries={}
  local dig=operation=='mine' and df.tile_dig_designation.Default or df.tile_dig_designation.Channel
  for xx=math.max(1,math.min(x,x2)),math.min(sx-2,math.max(x,x2)) do
    for yy=math.max(1,math.min(y,y2)),math.min(sy-2,math.max(y,y2)) do
      local b=dfhack.maps.getTileBlock(xx,yy,z)
      if b then
        local lx,ly=xx%16,yy%16
        local f=b.designation[lx][ly]
        if not f.hidden and b.occupancy[lx][ly].building==0 and (f.dig==df.tile_dig_designation.No or f.dig==dig) then
          local attrs=df.tiletype.attrs[b.tiletype[lx][ly]]
          local material=df.tiletype_material[attrs.material]
          local shape=df.tiletype_shape[attrs.shape]
          local natural=material~='CONSTRUCTION' and material~='TREE' and material~='ROOT' and material~='MUSHROOM' and material~='PLANT'
          local wall=shape=='WALL' or shape=='FORTIFICATION'
          local floor=shape=='FLOOR' or shape=='BOULDER' or shape=='PEBBLES' or shape=='BROOK_BED' or shape=='BROOK_TOP' or shape=='RAMP' or shape=='STAIR_UP' or shape=='STAIR_DOWN' or shape=='STAIR_UPDOWN'
          if natural and (wall or operation~='mine' and floor) then entries[#entries+1]={flags=f,old=f.dig,block=b} end
        end
      end
    end
  end
  if #entries==0 then reject('No eligible revealed tiles in this rectangle');return end
  if dry=='true' then result('READY:'..#entries);return end
  for _,entry in ipairs(entries) do entry.flags.dig=dig;entry.block.flags.designated=true end
  local ok=pcall(dfhack.job.checkDesignationsNow)
  if not ok then for _,entry in ipairs(entries) do entry.flags.dig=entry.old;entry.block.flags.designated=true end;reject('Designation failed');return end
  result('DESIGNATED:'..#entries);return
end
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
