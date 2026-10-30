import type { Rect } from "./native-workshop-geometry.js";
export interface NativeRegion {
  id: string;
  rect: Rect;
  kind: "vessel" | "sack" | "box" | "rack" | "stool" | "stone";
  base?: boolean;
  texturePatches?: { top?: Rect; body?: Rect };
}
// Semantic source bounds in local vanilla mosaics; these are not image assets.
export const nativeRegions: Record<string, NativeRegion[]> = {
  WORKSHOP_FARMER: [
    {
      id: "rear-closed-cask",
      rect: [10, 16, 34, 47],
      kind: "vessel",
    },
    {
      id: "left-open-barrel",
      rect: [3, 31, 27, 62],
      kind: "vessel",
    },
    {
      id: "small-sack",
      rect: [25, 47, 39, 64],
      kind: "sack",
    },
    {
      id: "rear-table-pail",
      rect: [42, 19, 58, 42],
      kind: "vessel",
    },
    {
      id: "rear-table-bowl",
      rect: [35, 32, 49, 45],
      kind: "vessel",
    },
    {
      id: "right-sack",
      rect: [64, 26, 91, 48],
      kind: "sack",
    },
    {
      id: "front-left-tub",
      rect: [7, 95, 27, 110],
      kind: "vessel",
    },
    {
      id: "front-spool",
      rect: [32, 97, 43, 120],
      kind: "vessel",
    },
    {
      id: "front-stool",
      rect: [42, 105, 59, 124],
      kind: "stool",
    },
    {
      id: "spinning-wheel",
      rect: [62, 90, 95, 126],
      kind: "rack",
    },
  ],
  WORKSHOP_TANNER: [
    {
      id: "rear-crate",
      rect: [5, 16, 25, 36],
      kind: "box",
    },
    {
      id: "large-open-pot",
      rect: [3, 40, 30, 70],
      kind: "vessel",
    },
    {
      id: "rear-lidded-pot",
      rect: [32, 20, 57, 45],
      kind: "vessel",
    },
    {
      id: "rear-spool",
      rect: [32, 35, 42, 52],
      kind: "vessel",
    },
    {
      id: "rear-wood-pail",
      rect: [56, 29, 71, 50],
      kind: "vessel",
    },
    {
      id: "rear-metal-pail",
      rect: [41, 41, 62, 62],
      kind: "vessel",
    },
    {
      id: "centre-stool",
      rect: [40, 67, 57, 85],
      kind: "stool",
    },
    {
      id: "front-wood-pail",
      rect: [32, 105, 48, 126],
      kind: "vessel",
    },
    {
      id: "right-sack",
      rect: [57, 94, 72, 108],
      kind: "sack",
    },
    {
      id: "right-tin-pail",
      rect: [68, 100, 79, 112],
      kind: "vessel",
    },
    {
      id: "right-tan-sack",
      rect: [76, 90, 93, 107],
      kind: "sack",
    },
  ],
  WORKSHOP_DYER: [
    {
      id: "rear-lidded-pot",
      rect: [9, 20, 33, 47],
      kind: "vessel",
    },
    {
      id: "rear-blue-vat",
      rect: [2, 36, 24, 61],
      kind: "vessel",
    },
    {
      id: "rear-round-jug",
      rect: [17, 46, 39, 71],
      kind: "vessel",
    },
    {
      id: "mortar",
      rect: [40, 28, 58, 43],
      kind: "vessel",
    },
    {
      id: "pestle",
      rect: [47, 18, 55, 35],
      kind: "rack",
    },
    {
      id: "rear-green-pail",
      rect: [64, 24, 80, 45],
      kind: "vessel",
    },
    {
      id: "front-wood-pail",
      rect: [6, 83, 22, 101],
      kind: "vessel",
    },
    {
      id: "front-cloth-crate",
      rect: [38, 102, 65, 126],
      kind: "box",
    },
    {
      id: "right-blue-stock",
      rect: [69, 68, 94, 94],
      kind: "vessel",
    },
    {
      id: "right-dye-bowl",
      rect: [70, 96, 89, 111],
      kind: "vessel",
    },
  ],
  WORKSHOP_ASHERY: [
    {
      id: "rear-logs",
      rect: [3, 25, 25, 55],
      kind: "rack",
    },
    {
      id: "rear-pail",
      rect: [43, 14, 59, 40],
      kind: "vessel",
    },
    {
      id: "front-table-pail",
      rect: [37, 25, 53, 47],
      kind: "vessel",
    },
    {
      id: "right-tub",
      rect: [64, 26, 89, 51],
      kind: "vessel",
    },
    {
      id: "right-pail",
      rect: [76, 38, 92, 58],
      kind: "vessel",
    },
    {
      id: "central-barrel",
      rect: [44, 49, 67, 80],
      kind: "vessel",
    },
    {
      id: "front-left-box",
      rect: [4, 88, 30, 113],
      kind: "box",
    },
    {
      id: "front-logs",
      rect: [32, 97, 52, 126],
      kind: "rack",
    },
    {
      id: "front-sack",
      rect: [53, 98, 80, 126],
      kind: "sack",
    },
  ],
  WORKSHOP_CLOTHES: [
    {
      id: "rack-frame",
      rect: [32, 2, 93, 33],
      kind: "rack",
    },
    {
      id: "rear-crate",
      rect: [32, 32, 48, 53],
      kind: "box",
    },
    {
      id: "front-spool-crate",
      rect: [5, 89, 33, 126],
      kind: "box",
    },
    {
      id: "front-sack",
      rect: [78, 103, 95, 125],
      kind: "sack",
    },
  ],
  WORKSHOP_FISHERY: [
    {
      id: "rear-net",
      rect: [39, 16, 96, 48],
      kind: "rack",
    },
    {
      id: "front-open-barrel",
      rect: [7, 94, 32, 125],
      kind: "vessel",
    },
    {
      id: "front-pail",
      rect: [65, 100, 81, 124],
      kind: "vessel",
    },
  ],
  WORKSHOP_LEATHER: [
    {
      id: "rear-large-crate",
      rect: [3, 21, 33, 51],
      kind: "box",
    },
    {
      id: "rear-chest",
      rect: [4, 47, 26, 65],
      kind: "box",
    },
    {
      id: "rear-upper-spool",
      rect: [33, 32, 44, 46],
      kind: "vessel",
    },
    {
      id: "rear-lower-spool",
      rect: [28, 41, 39, 56],
      kind: "vessel",
    },
    {
      id: "right-hide-stack",
      rect: [69, 49, 94, 74],
      kind: "sack",
    },
    {
      id: "left-sack",
      rect: [4, 88, 25, 105],
      kind: "sack",
    },
    {
      id: "front-low-crate",
      rect: [40, 108, 66, 126],
      kind: "box",
    },
    {
      id: "front-crate-hide",
      rect: [49, 99, 65, 112],
      kind: "sack",
    },
  ],
  "WORKSHOP_CUSTOM:SOAP_MAKER": [
    {
      id: "rear-closed-barrel",
      rect: [4, 22, 26, 51],
      kind: "vessel",
    },
    {
      id: "rear-open-pail",
      rect: [24, 23, 40, 43],
      kind: "vessel",
    },
    {
      id: "right-metal-pail",
      rect: [70, 16, 86, 37],
      kind: "vessel",
    },
    {
      id: "right-bottle",
      rect: [85, 15, 91, 31],
      kind: "vessel",
    },
    {
      id: "right-bowl",
      rect: [74, 31, 93, 46],
      kind: "vessel",
    },
    {
      id: "right-mortar",
      rect: [69, 52, 85, 67],
      kind: "vessel",
    },
    {
      id: "right-pestle",
      rect: [75, 46, 82, 58],
      kind: "rack",
    },
    {
      id: "front-large-pot",
      rect: [3, 96, 29, 126],
      kind: "vessel",
    },
    {
      id: "front-rear-jug",
      rect: [9, 88, 30, 108],
      kind: "vessel",
    },
    {
      id: "front-lidded-pot",
      rect: [26, 95, 48, 125],
      kind: "vessel",
    },
    {
      id: "front-right-pot",
      rect: [39, 104, 63, 127],
      kind: "vessel",
    },
  ],
  WORKSHOP_CARPENTER: [
    {
      id: "rear-left-log-stock",
      rect: [3, 24, 23, 55],
      kind: "rack",
      texturePatches: {
        body: [7, 29, 10, 43],
      },
    },
    {
      id: "rear-left-saw",
      rect: [18, 25, 29, 49],
      kind: "rack",
    },
    {
      id: "rear-left-stock-base",
      rect: [3, 48, 29, 57],
      kind: "box",
    },
    {
      id: "rear-right-cabinet",
      rect: [63, 18, 94, 51],
      kind: "box",
      texturePatches: {
        top: [68, 22, 82, 27],
        body: [65, 32, 70, 39],
      },
    },
    {
      id: "rear-right-small-stool",
      rect: [73, 43, 93, 61],
      kind: "stool",
    },
    {
      id: "front-centre-stool",
      rect: [43, 103, 62, 124],
      kind: "stool",
    },
    {
      id: "front-right-tool-caddy",
      rect: [67, 93, 85, 113],
      kind: "box",
    },
    {
      id: "front-right-caddy-handle",
      rect: [72, 88, 93, 100],
      kind: "rack",
    },
  ],
  WORKSHOP_MASON: [
    {
      id: "rear-stool",
      rect: [46, 28, 63, 47],
      kind: "stool",
      base: true,
      texturePatches: {
        top: [49, 30, 58, 35],
      },
    },
    {
      id: "left-jar",
      rect: [2, 40, 23, 63],
      kind: "vessel",
      texturePatches: {
        body: [9, 51, 15, 57],
      },
    },
    {
      id: "front-left-stool",
      rect: [6, 89, 23, 107],
      kind: "stool",
      base: true,
      texturePatches: {
        top: [9, 92, 18, 97],
      },
    },
    {
      id: "rear-stone-cylinder",
      rect: [70, 20, 90, 41],
      kind: "stone",
      texturePatches: {
        top: [75, 23, 83, 27],
        body: [76, 30, 81, 36],
      },
    },
    {
      id: "right-square-block",
      rect: [70, 67, 88, 83],
      kind: "box",
      texturePatches: {
        top: [74, 68, 81, 71],
        body: [75, 74, 80, 79],
      },
    },
    {
      id: "front-rear-tan-block",
      rect: [75, 84, 92, 103],
      kind: "box",
    },
    {
      id: "front-brown-boulder",
      rect: [45, 86, 70, 103],
      kind: "stone",
    },
    {
      id: "front-left-grey-boulder",
      rect: [40, 99, 62, 118],
      kind: "stone",
    },
    {
      id: "front-right-dark-boulder",
      rect: [63, 99, 87, 116],
      kind: "stone",
    },
    {
      id: "front-small-grey-rock",
      rect: [48, 113, 68, 124],
      kind: "stone",
    },
  ],
  WORKSHOP_CRAFTS: [
    {
      id: "rear-log-bundle",
      rect: [46, 27, 66, 55],
      kind: "rack",
      texturePatches: {
        body: [50, 31, 53, 44],
      },
    },
    {
      id: "centre-stool",
      rect: [37, 58, 55, 76],
      kind: "stool",
      texturePatches: {
        top: [40, 60, 51, 65],
      },
    },
    {
      id: "front-stone-craft",
      rect: [4, 93, 24, 109],
      kind: "stone",
    },
    {
      id: "front-right-bin",
      rect: [63, 103, 92, 124],
      kind: "box",
      texturePatches: {
        body: [67, 115, 85, 119],
      },
    },
  ],
  WORKSHOP_JEWELER: [
    {
      id: "rear-left-cabinet",
      rect: [2, 24, 34, 52],
      kind: "box",
      texturePatches: {
        body: [5, 36, 27, 41],
      },
    },
    {
      id: "rear-green-gem",
      rect: [7, 16, 18, 27],
      kind: "stone",
    },
    {
      id: "rear-pink-gem",
      rect: [14, 21, 27, 31],
      kind: "stone",
    },
    {
      id: "rear-gold-gem",
      rect: [19, 12, 29, 24],
      kind: "stone",
    },
    {
      id: "rear-left-small-chest",
      rect: [6, 47, 25, 65],
      kind: "box",
    },
    {
      id: "centre-stool",
      rect: [45, 56, 63, 75],
      kind: "stool",
      texturePatches: {
        top: [48, 58, 59, 63],
      },
    },
    {
      id: "right-crown",
      rect: [68, 13, 92, 37],
      kind: "rack",
    },
    {
      id: "right-red-gem",
      rect: [75, 57, 90, 77],
      kind: "stone",
    },
    {
      id: "right-gem-stand",
      rect: [73, 73, 89, 86],
      kind: "rack",
    },
    {
      id: "front-stool",
      rect: [33, 97, 52, 117],
      kind: "stool",
      texturePatches: {
        top: [36, 99, 48, 105],
      },
    },
    {
      id: "left-tall-green-crystal",
      rect: [5, 86, 14, 102],
      kind: "stone",
    },
    {
      id: "left-front-green-crystal",
      rect: [3, 102, 14, 117],
      kind: "stone",
    },
    {
      id: "left-centre-green-crystal",
      rect: [13, 97, 25, 114],
      kind: "stone",
    },
    {
      id: "left-right-green-crystal",
      rect: [20, 105, 32, 118],
      kind: "stone",
    },
    {
      id: "left-low-green-crystal",
      rect: [12, 112, 23, 122],
      kind: "stone",
    },
    {
      id: "left-rear-small-crystal",
      rect: [28, 91, 37, 104],
      kind: "stone",
    },
    {
      id: "front-right-loose-crystal",
      rect: [49, 112, 63, 124],
      kind: "stone",
    },
  ],
  WORKSHOP_BOWYER: [
    {
      id: "rear-low-wood-bench",
      rect: [36, 29, 55, 43],
      kind: "stool",
      texturePatches: {
        top: [38, 31, 49, 34],
      },
    },
    {
      id: "rear-silver-bow-frame",
      rect: [33, 30, 58, 57],
      kind: "rack",
    },
    {
      id: "rear-small-sack",
      rect: [51, 21, 67, 39],
      kind: "sack",
    },
    {
      id: "rear-spool",
      rect: [56, 29, 67, 45],
      kind: "vessel",
    },
    {
      id: "rear-open-barrel",
      rect: [65, 17, 85, 45],
      kind: "vessel",
      texturePatches: {
        body: [69, 30, 74, 36],
      },
    },
    {
      id: "rear-quiver-container",
      rect: [77, 32, 93, 53],
      kind: "vessel",
      texturePatches: {
        body: [81, 42, 87, 47],
      },
    },
    {
      id: "rear-quiver-shafts",
      rect: [78, 22, 91, 39],
      kind: "rack",
    },
    {
      id: "centre-stool",
      rect: [55, 52, 74, 71],
      kind: "stool",
      texturePatches: {
        top: [58, 54, 69, 59],
      },
    },
    {
      id: "front-long-bow-stock",
      rect: [46, 103, 79, 125],
      kind: "rack",
    },
    {
      id: "front-upright-logs",
      rect: [73, 97, 93, 125],
      kind: "rack",
      texturePatches: {
        body: [80, 101, 83, 115],
      },
    },
  ],
  WORKSHOP_SIEGE: [
    {
      id: "rear-left-end-support",
      rect: [2, 32, 23, 58],
      kind: "rack",
    },
    {
      id: "rear-left-long-beam",
      rect: [21, 32, 65, 48],
      kind: "rack",
      texturePatches: {
        body: [29, 35, 57, 39],
      },
    },
    {
      id: "rear-left-raised-cup",
      rect: [25, 16, 40, 34],
      kind: "vessel",
    },
    {
      id: "rear-left-right-pivot",
      rect: [61, 25, 79, 52],
      kind: "rack",
    },
    {
      id: "rear-left-pivot-wheel",
      rect: [65, 45, 75, 53],
      kind: "vessel",
    },
    {
      id: "rear-right-left-beam",
      rect: [83, 35, 124, 49],
      kind: "rack",
      texturePatches: {
        body: [89, 37, 101, 40],
      },
    },
    {
      id: "rear-right-centre-bracket",
      rect: [104, 29, 130, 56],
      kind: "rack",
    },
    {
      id: "rear-right-upright",
      rect: [124, 23, 132, 57],
      kind: "rack",
    },
    {
      id: "rear-right-upper-arm",
      rect: [131, 27, 154, 41],
      kind: "rack",
    },
    {
      id: "rear-right-front-post",
      rect: [133, 45, 142, 78],
      kind: "rack",
    },
    {
      id: "rear-right-short-arm",
      rect: [139, 46, 158, 56],
      kind: "rack",
    },
    {
      id: "left-upright-log-stock",
      rect: [2, 57, 23, 86],
      kind: "rack",
    },
    {
      id: "left-saw-stock",
      rect: [23, 59, 50, 90],
      kind: "rack",
    },
    {
      id: "left-loose-logs",
      rect: [13, 88, 49, 108],
      kind: "rack",
    },
    {
      id: "upper-right-stool",
      rect: [112, 68, 130, 87],
      kind: "stool",
      base: true,
      texturePatches: {
        top: [115, 71, 125, 76],
      },
    },
    {
      id: "right-middle-stool",
      rect: [132, 96, 150, 117],
      kind: "stool",
      base: true,
      texturePatches: {
        top: [136, 99, 145, 105],
      },
    },
    {
      id: "middle-poles",
      rect: [105, 104, 132, 131],
      kind: "rack",
    },
    {
      id: "front-left-working-stool",
      rect: [28, 131, 47, 153],
      kind: "stool",
    },
    {
      id: "front-centre-stool",
      rect: [85, 162, 103, 182],
      kind: "stool",
      texturePatches: {
        top: [88, 165, 99, 170],
      },
    },
    {
      id: "front-left-long-lever",
      rect: [3, 160, 52, 191],
      kind: "rack",
    },
    {
      id: "front-right-a-frame",
      rect: [99, 162, 137, 191],
      kind: "rack",
    },
    {
      id: "front-right-engine-arm",
      rect: [117, 148, 160, 177],
      kind: "rack",
    },
  ],
  WORKSHOP_BUTCHER: [
    {
      id: "rack-left-post",
      rect: [3, 0, 7, 32],
      kind: "rack",
    },
    {
      id: "rack-right-post",
      rect: [61, 0, 65, 37],
      kind: "rack",
    },
    {
      id: "rack-top-crossbar",
      rect: [5, 2, 63, 8],
      kind: "rack",
    },
    {
      id: "rack-low-crossbar",
      rect: [24, 26, 60, 32],
      kind: "rack",
      texturePatches: {
        body: [28, 28, 53, 30],
      },
    },
    {
      id: "rack-metal-hooks",
      rect: [39, 3, 60, 13],
      kind: "rack",
    },
    {
      id: "rear-left-cage",
      rect: [2, 23, 25, 42],
      kind: "rack",
    },
    {
      id: "rear-right-basket",
      rect: [53, 27, 65, 39],
      kind: "box",
    },
    {
      id: "rear-right-open-barrel",
      rect: [66, 10, 81, 25],
      kind: "vessel",
      texturePatches: {
        body: [69, 18, 76, 23],
      },
    },
    {
      id: "right-front-stool",
      rect: [76, 87, 94, 105],
      kind: "stool",
      base: true,
      texturePatches: {
        top: [80, 90, 88, 95],
      },
    },
    {
      id: "left-sacks",
      rect: [3, 46, 29, 65],
      kind: "sack",
    },
    {
      id: "front-bone-bin",
      rect: [5, 92, 36, 114],
      kind: "box",
      texturePatches: {
        body: [25, 106, 32, 111],
      },
    },
    {
      id: "front-metal-pail",
      rect: [3, 100, 24, 123],
      kind: "vessel",
      texturePatches: {
        body: [8, 109, 14, 115],
      },
    },
  ],
  WORKSHOP_KENNEL: [
    {
      id: "upper-white-rope-post",
      rect: [56, 53, 73, 75],
      kind: "rack",
    },
    {
      id: "upper-brown-rope-post",
      rect: [73, 62, 89, 83],
      kind: "rack",
    },
    {
      id: "left-upper-peg",
      rect: [24, 79, 29, 93],
      kind: "rack",
    },
    {
      id: "left-lower-peg",
      rect: [15, 89, 21, 104],
      kind: "rack",
    },
    {
      id: "rear-centre-peg",
      rect: [106, 51, 111, 65],
      kind: "rack",
    },
    {
      id: "rear-right-peg",
      rect: [137, 61, 143, 76],
      kind: "rack",
    },
    {
      id: "front-left-peg",
      rect: [25, 151, 31, 166],
      kind: "rack",
    },
    {
      id: "front-right-peg",
      rect: [141, 137, 148, 152],
      kind: "rack",
    },
    {
      id: "front-brown-rope-post",
      rect: [122, 144, 139, 165],
      kind: "rack",
    },
    {
      id: "right-barrel",
      rect: [94, 96, 112, 118],
      kind: "vessel",
      texturePatches: {
        body: [98, 106, 106, 111],
      },
    },
    {
      id: "right-small-sack",
      rect: [105, 112, 121, 127],
      kind: "sack",
    },
    {
      id: "right-rear-metal-cage",
      rect: [115, 93, 141, 114],
      kind: "rack",
    },
    {
      id: "right-front-wood-cage",
      rect: [123, 105, 147, 125],
      kind: "rack",
    },
    {
      id: "front-left-stool",
      rect: [9, 129, 29, 148],
      kind: "stool",
      texturePatches: {
        top: [12, 132, 25, 137],
      },
    },
  ],
  WORKSHOP_KITCHEN: [
    {
      id: "rear-barrel",
      rect: [4, 19, 29, 51],
      kind: "vessel",
      texturePatches: {
        body: [10, 36, 16, 43],
      },
    },
    {
      id: "stove-body",
      rect: [34, 27, 66, 57],
      kind: "box",
      base: true,
      texturePatches: {
        body: [37, 50, 51, 54],
      },
    },
    {
      id: "stove-grille",
      rect: [35, 28, 61, 48],
      kind: "rack",
    },
    {
      id: "rear-right-cauldron",
      rect: [64, 25, 88, 49],
      kind: "vessel",
      texturePatches: {
        body: [70, 32, 78, 39],
      },
    },
    {
      id: "front-left-wood-bin",
      rect: [4, 105, 34, 125],
      kind: "box",
      texturePatches: {
        body: [8, 117, 27, 121],
      },
    },
    {
      id: "front-dish-stack",
      rect: [7, 94, 25, 110],
      kind: "vessel",
    },
    {
      id: "front-pale-bowl",
      rect: [20, 91, 38, 100],
      kind: "vessel",
    },
    {
      id: "front-open-barrel",
      rect: [33, 97, 56, 125],
      kind: "vessel",
      texturePatches: {
        body: [39, 113, 48, 120],
      },
    },
  ],
  WORKSHOP_MECHANIC: [
    {
      id: "centre-stool",
      rect: [43, 75, 61, 95],
      kind: "stool",
    },
  ],
  WORKSHOP_LOOM: [
    {
      id: "left-upper-spool",
      rect: [3, 32, 20, 53],
      kind: "vessel",
    },
    {
      id: "left-front-spool",
      rect: [3, 47, 14, 65],
      kind: "vessel",
    },
    {
      id: "left-second-spool",
      rect: [12, 52, 22, 72],
      kind: "vessel",
    },
    {
      id: "right-stool",
      rect: [77, 65, 94, 82],
      kind: "stool",
    },
    {
      id: "front-open-bin",
      rect: [63, 102, 94, 126],
      kind: "box",
    },
  ],
  WORKSHOP_METALSMITH: [
    {
      id: "left-barrel",
      rect: [2, 77, 23, 105],
      kind: "vessel",
    },
    {
      id: "front-metal-pail",
      rect: [21, 97, 36, 123],
      kind: "vessel",
    },
  ],
  WORKSHOP_MAGMAFORGE: [
    {
      id: "left-barrel",
      rect: [2, 77, 23, 105],
      kind: "vessel",
    },
    {
      id: "front-metal-pail",
      rect: [21, 97, 36, 123],
      kind: "vessel",
    },
  ],
};

nativeRegions.WORKSHOP_STILL = [
  { id: "front-left-barrel", rect: [2, 83, 22, 110], kind: "vessel" },
  { id: "front-right-barrel", rect: [14, 99, 38, 122], kind: "vessel" },
  { id: "front-tool-bin", rect: [40, 100, 65, 127], kind: "box" },
  { id: "front-produce-bin", rect: [66, 99, 95, 127], kind: "box" },
];

export const nativeTables: Record<string, { rect: Rect; stool: boolean }[]> = {
  WORKSHOP_FARMER: [
    {
      rect: [33, 25, 63, 57],
      stool: false,
    },
    {
      rect: [2, 92, 32, 125],
      stool: false,
    },
  ],
  WORKSHOP_TANNER: [
    {
      rect: [2, 25, 32, 57],
      stool: false,
    },
    {
      rect: [65, 69, 94, 96],
      stool: false,
    },
    {
      rect: [2, 92, 32, 124],
      stool: false,
    },
  ],
  WORKSHOP_DYER: [
    {
      rect: [33, 26, 63, 57],
      stool: false,
    },
    {
      rect: [2, 93, 32, 125],
      stool: false,
    },
    {
      rect: [64, 94, 94, 125],
      stool: false,
    },
  ],
  WORKSHOP_ASHERY: [
    {
      rect: [32, 26, 63, 57],
      stool: false,
    },
    {
      rect: [2, 95, 32, 125],
      stool: false,
    },
  ],
  WORKSHOP_CLOTHES: [
    {
      rect: [2, 26, 32, 58],
      stool: false,
    },
    {
      rect: [33, 93, 63, 125],
      stool: false,
    },
  ],
  WORKSHOP_FISHERY: [
    {
      rect: [2, 25, 63, 57],
      stool: false,
    },
    {
      rect: [32, 92, 63, 124],
      stool: false,
    },
  ],
  WORKSHOP_LEATHER: [
    {
      rect: [65, 26, 94, 58],
      stool: false,
    },
    {
      rect: [2, 68, 32, 101],
      stool: false,
    },
    {
      rect: [65, 93, 94, 125],
      stool: false,
    },
  ],
  "WORKSHOP_CUSTOM:SOAP_MAKER": [
    {
      rect: [65, 27, 94, 94],
      stool: false,
    },
  ],
  WORKSHOP_CARPENTER: [
    {
      rect: [2, 57, 31, 124],
      stool: false,
    },
    {
      rect: [65, 92, 94, 124],
      stool: false,
    },
  ],
  WORKSHOP_MASON: [
    {
      rect: [46, 28, 63, 47],
      stool: true,
    },
    {
      rect: [2, 63, 31, 95],
      stool: false,
    },
    {
      rect: [6, 89, 23, 107],
      stool: true,
    },
    {
      rect: [65, 25, 94, 95],
      stool: false,
    },
  ],
  WORKSHOP_CRAFTS: [
    {
      rect: [65, 25, 94, 57],
      stool: false,
    },
    {
      rect: [2, 63, 32, 124],
      stool: false,
    },
    {
      rect: [31, 94, 63, 124],
      stool: false,
    },
  ],
  WORKSHOP_JEWELER: [
    {
      rect: [65, 25, 94, 124],
      stool: false,
    },
  ],
  WORKSHOP_BOWYER: [
    {
      rect: [2, 25, 31, 124],
      stool: false,
    },
  ],
  WORKSHOP_SIEGE: [
    {
      rect: [50, 66, 110, 98],
      stool: false,
    },
    {
      rect: [112, 68, 130, 87],
      stool: true,
    },
    {
      rect: [132, 96, 150, 117],
      stool: true,
    },
    {
      rect: [50, 130, 110, 162],
      stool: false,
    },
  ],
  WORKSHOP_BUTCHER: [
    {
      rect: [65, 25, 94, 95],
      stool: false,
    },
    {
      rect: [76, 87, 94, 105],
      stool: true,
    },
    {
      rect: [2, 63, 31, 96],
      stool: false,
    },
  ],
  WORKSHOP_KENNEL: [],
  WORKSHOP_KITCHEN: [
    {
      rect: [65, 26, 94, 100],
      stool: false,
    },
  ],
};
