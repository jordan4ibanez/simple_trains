import { Drawtype, Nodeboxtype, ParamType1, ParamType2 } from "./utility/enums";

export function trackRegistration() {}

core.register_node("simple_trains:track_straight", {
	paramtype: ParamType1.light,
	paramtype2: ParamType2["4dir"],
	drawtype: Drawtype.mesh,
	mesh: "track_straight.gltf",
	tiles: ["track_straight.png"],
	collision_box: {
		type: Nodeboxtype.fixed,
		fixed: [-0.5, -0.5, -0.5, 0.5, -0.3, 0.5],
	},
	selection_box: {
		type: Nodeboxtype.fixed,
		fixed: [-0.5, -0.5, -0.5, 0.5, -0.3, 0.5],
	},
	groups: {
		oddly_breakable_by_hand: 1,
	},
});

export const trackStraightID = core.get_content_id(
	"simple_trains:track_straight",
);
