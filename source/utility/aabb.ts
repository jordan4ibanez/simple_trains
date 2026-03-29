import { Vec3 } from "./vector";

// This is specifically used to calculate if 2 rail vehicles are colliding.
// I would not use this in other mods.
export class AABB {
	pos: Vec3 = new Vec3();
	size: Vec3 = new Vec3();
}
