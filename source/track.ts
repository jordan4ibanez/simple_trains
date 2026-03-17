import { Drawtype, ParamType1, ParamType2 } from "./utility/enums";

export function trackRegistration() {}

core.register_node("simple_trains:track_straight", {
	paramtype: ParamType1.light,
	paramtype2: ParamType2["4dir"],
	drawtype: Drawtype.mesh,
	mesh: "track_straight.gltf",
	tiles: ["track_straight.png"],
});
