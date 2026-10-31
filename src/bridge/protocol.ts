import protobuf from "protobufjs";
// Deliberately restricted wire-compatible subset; field numbers verified against
// DFHack 0bf381cc. Commands are limited to the fixed miner and bounded read-only
// artwork identity lookups.
const schema = `syntax="proto2";package dfproto;
message EmptyMessage {} message CoreBindRequest {required string method=1;required string input_msg=2;required string output_msg=3;optional string plugin=4;} message CoreBindReply {required int32 assigned_id=1;}
message CoreRunCommandRequest {required string command=1;repeated string arguments=2;}
message CoreTextNotification {repeated CoreTextFragment fragments=1;}
message CoreTextFragment {required string text=1;optional int32 color=2;}
package RemoteFortressReader;
message VersionInfo {optional string dwarf_fortress_version=1;optional string dfhack_version=2;optional string remote_fortress_reader_version=3;}
message MapInfo {optional int32 block_size_x=1;optional int32 block_size_y=2;optional int32 block_size_z=3;optional int32 block_pos_x=4;optional int32 block_pos_y=5;optional int32 block_pos_z=6;optional string world_name=7;optional string world_name_english=8;optional string save_name=9;}
message ViewInfo {optional int32 view_pos_x=1;optional int32 view_pos_y=2;optional int32 view_pos_z=3;optional int32 view_size_x=4;optional int32 view_size_y=5;}
message Tiletype {required int32 id=1;optional string name=2;optional string caption=3;optional int32 shape=4;optional int32 special=5;optional int32 material=6;optional int32 variant=7;}
message TiletypeList {repeated Tiletype tiletype_list=1;}
message BlockRequest {optional int32 blocks_needed=1;optional int32 min_x=2;optional int32 max_x=3;optional int32 min_y=4;optional int32 max_y=5;optional int32 min_z=6;optional int32 max_z=7;optional bool force_reload=8;}
message BuildingType {required int32 building_type=1;required int32 building_subtype=2;required int32 building_custom=3;}
message BuildingDefinition {required BuildingType building_type=1;optional string id=2;optional string name=3;}
message BuildingList {repeated BuildingDefinition building_list=1;}
message BuildingItem {optional Item item=1;optional int32 mode=2;}
message BuildingInstance {required int32 index=1;optional int32 pos_x_min=2;optional int32 pos_y_min=3;optional int32 pos_z_min=4;optional int32 pos_x_max=5;optional int32 pos_y_max=6;optional int32 pos_z_max=7;optional BuildingType building_type=8;optional MatPair material=9;optional uint32 building_flags=10;optional int32 direction=13;repeated BuildingItem items=14;optional int32 active=15;}
message Coord {optional int32 x=1;optional int32 y=2;optional int32 z=3;}
message PlantDef {required int32 pos_x=1;required int32 pos_y=2;required int32 pos_z=3;required int32 index=4;}
message PlantList {repeated PlantDef plant_list=1;}
message PlantRaw {optional int32 index=1;optional string id=2;optional string name=3;optional int32 tile=5;}
message PlantRawList {repeated PlantRaw plant_raws=1;}
message FlowInfo {optional int32 index=1;optional int32 type=2;optional int32 density=3;optional Coord pos=4;optional Coord dest=5;optional bool expanding=6;optional int32 guide_id=8;optional MatPair material=9;optional MatPair item=10;optional bool dead=11;optional bool fast=12;optional bool creeping=13;}
message MapBlock {required int32 map_x=1;required int32 map_y=2;required int32 map_z=3;repeated int32 tiles=4;repeated MatPair materials=5;repeated MatPair layer_materials=6;repeated MatPair base_materials=8;repeated int32 magma=9;repeated int32 water=10;repeated bool hidden=11;repeated BuildingInstance buildings=19;repeated int32 tree_percent=20;repeated int32 tile_dig_designation=24;repeated Item items=26;repeated int32 grass_percent=29;repeated FlowInfo flows=30;}
message BlockList {repeated MapBlock map_blocks=1;}
message MatPair {required int32 mat_type=1;required int32 mat_index=2;}
message UnitDefinition {required int32 id=1;optional int32 pos_x=3;optional int32 pos_y=4;optional int32 pos_z=5;optional MatPair race=6;optional uint32 flags1=8;optional uint32 flags2=9;optional uint32 flags3=10;optional BodySizeInfo size_info=12;optional int32 profession_id=17;optional string name=13;optional ColorDefinition profession_color=7;optional UnitAppearance appearance=16;repeated InventoryItem inventory=20;optional int32 age=25;}
message BodySizeInfo {optional int32 size_cur=1;optional int32 size_base=2;}
message UnitList {repeated UnitDefinition creature_list=1;}
message ListRequest {optional int32 list_start=1;optional int32 list_end=2;}
message ColorDefinition {required int32 red=1;required int32 green=2;required int32 blue=3;}
message Hair {optional int32 length=1;optional int32 style=2;}
message UnitAppearance {repeated int32 bp_modifiers=2;repeated int32 colors=4;optional Hair hair=5;optional Hair beard=6;optional Hair moustache=7;optional Hair sideburns=8;}
message Item {optional int32 id=1;optional Coord pos=2;optional uint32 flags1=3;optional uint32 flags2=4;optional MatPair type=5;optional MatPair material=6;optional ColorDefinition dye=7;optional int32 stack_size=8;optional float subpos_x=9;optional float subpos_y=10;optional float subpos_z=11;optional bool projectile=12;optional float velocity_x=13;optional float velocity_y=14;optional float velocity_z=15;optional int32 volume=16;}
message InventoryItem {optional int32 mode=1;optional Item item=2;optional int32 body_part_id=3;}
message MaterialDefinition {required MatPair mat_pair=1;optional string id=2;optional string name=3;optional ColorDefinition state_color=4;}
message MaterialList {repeated MaterialDefinition material_list=1;}
message BodyPartLayerRaw {optional string layer_name=1;repeated int32 bp_modifiers=4;}
message BodyPartRaw {optional string token=1;optional string category=2;repeated BodyPartLayerRaw layers=5;}
message BpAppearanceModifier {optional string type=1;}
message PatternDescriptor {optional string id=1;repeated ColorDefinition colors=2;optional int32 pattern=3;}
message ColorModifierRaw {repeated PatternDescriptor patterns=1;repeated int32 body_part_id=2;repeated int32 tissue_layer_id=3;optional int32 start_date=4;optional int32 end_date=5;optional string part=6;}
message CasteRaw {optional int32 index=1;optional string caste_id=2;repeated BodyPartRaw body_parts=7;repeated ColorModifierRaw color_modifiers=14;repeated BpAppearanceModifier modifiers=9;repeated int32 modifier_idx=10;repeated int32 part_idx=11;repeated int32 layer_idx=12;}
message CreatureRaw {optional int32 index=1;optional string creature_id=2;repeated CasteRaw caste=10;}
message CreatureRawList {repeated CreatureRaw creature_raws=1;}
`;
// protobufjs permits one package per parse, so parse the two scopes separately.
const [core, rfr] = schema.split("package RemoteFortressReader;");
export const root = protobuf.parse(core).root;
protobuf.parse('syntax="proto2";package RemoteFortressReader;' + rfr, root);
export const type = (name: string) => root.lookupType(name);
export const methods = {
  GetBuildingDefList: [
    "dfproto.EmptyMessage",
    "RemoteFortressReader.BuildingList",
  ],
  GetPlantRaws: ["dfproto.EmptyMessage", "RemoteFortressReader.PlantRawList"],
  GetPlantList: [
    "RemoteFortressReader.BlockRequest",
    "RemoteFortressReader.PlantList",
  ],
  GetItemList: ["dfproto.EmptyMessage", "RemoteFortressReader.MaterialList"],
  GetMaterialList: [
    "dfproto.EmptyMessage",
    "RemoteFortressReader.MaterialList",
  ],
  GetUnitListInside: [
    "RemoteFortressReader.BlockRequest",
    "RemoteFortressReader.UnitList",
  ],
  GetPartialCreatureRaws: [
    "RemoteFortressReader.ListRequest",
    "RemoteFortressReader.CreatureRawList",
  ],
  GetVersionInfo: ["dfproto.EmptyMessage", "RemoteFortressReader.VersionInfo"],
  GetMapInfo: ["dfproto.EmptyMessage", "RemoteFortressReader.MapInfo"],
  GetViewInfo: ["dfproto.EmptyMessage", "RemoteFortressReader.ViewInfo"],
  GetTiletypeList: [
    "dfproto.EmptyMessage",
    "RemoteFortressReader.TiletypeList",
  ],
  GetBlockList: [
    "RemoteFortressReader.BlockRequest",
    "RemoteFortressReader.BlockList",
  ],
} as const;
export type Method = keyof typeof methods;
