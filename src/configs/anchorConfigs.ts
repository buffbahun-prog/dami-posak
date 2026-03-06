import { Earth } from "../objects/Earth";
import { Mars } from "../objects/Mars";
import type { AnchorConfig } from "../types/types";

export const anchorConfigs: AnchorConfig[] = [
  {
    uuid: "earth",
    image: "earth-qr.png",
    widthInMeters: 0.045,
    position: { x: -0.15, y: -0.3, z: -0.3 },   // e.g., slightly above pocket
    scale: { x: 0.15, y: 0.15, z: 0.15 },   // desired size on T-shirt
    createObject: () => new Earth("earth-texture.jpg", 0.5)
  },
  {
    uuid: "mars",
    image: "mars-qr.png",
    widthInMeters: 0.095,
    position: { x: -0.15, y: -0.3, z: -0.3 }, // custom T-shirt placement
    scale: { x: 0.3, y: 0.3, z: 0.3 },
    createObject: () => new Mars("mars-texture.jpg", 0.3)
  }
]