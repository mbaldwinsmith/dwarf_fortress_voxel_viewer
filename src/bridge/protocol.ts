import protobuf from "protobufjs";
// Deliberately restricted wire-compatible subset; field numbers verified against
// DFHack 0bf381cc. No gameplay or command messages are exposed.
const schema = `syntax="proto2";package dfproto;
message EmptyMessage {} message CoreBindRequest {required string method=1;required string input_msg=2;required string output_msg=3;optional string plugin=4;} message CoreBindReply {required int32 assigned_id=1;}
package RemoteFortressReader;
message VersionInfo {optional string dwarf_fortress_version=1;optional string dfhack_version=2;optional string remote_fortress_reader_version=3;}
message MapInfo {optional int32 block_size_x=1;optional int32 block_size_y=2;optional int32 block_size_z=3;optional int32 block_pos_x=4;optional int32 block_pos_y=5;optional int32 block_pos_z=6;optional string world_name=7;optional string world_name_english=8;optional string save_name=9;}
message ViewInfo {optional int32 view_pos_x=1;optional int32 view_pos_y=2;optional int32 view_pos_z=3;optional int32 view_size_x=4;optional int32 view_size_y=5;}
message Tiletype {required int32 id=1;optional string name=2;optional string caption=3;optional int32 shape=4;optional int32 special=5;optional int32 material=6;}
message TiletypeList {repeated Tiletype tiletype_list=1;}
message BlockRequest {optional int32 blocks_needed=1;optional int32 min_x=2;optional int32 max_x=3;optional int32 min_y=4;optional int32 max_y=5;optional int32 min_z=6;optional int32 max_z=7;optional bool force_reload=8;}
message MapBlock {required int32 map_x=1;required int32 map_y=2;required int32 map_z=3;repeated int32 tiles=4;repeated bool hidden=11;}
message BlockList {repeated MapBlock map_blocks=1;}
`;
// protobufjs permits one package per parse, so parse the two scopes separately.
const [core, rfr] = schema.split("package RemoteFortressReader;");
export const root = protobuf.parse(core).root;
protobuf.parse('syntax="proto2";package RemoteFortressReader;' + rfr, root);
export const type = (name: string) => root.lookupType(name);
export const methods = {
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
