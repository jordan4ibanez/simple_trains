import { Drawtype, Nodeboxtype, ParamType1, ParamType2 } from "./utility/enums";

export function trackRegistration() {}

core.register_node("simple_trains:track_straight", {
	paramtype: ParamType1.light,
	paramtype2: ParamType2["4dir"],
	drawtype: Drawtype.nodebox,
	// mesh: "track_straight.gltf",
	tiles: ["default_dirt.png"],
	// collision_box: {
	// 	type: Nodeboxtype.fixed,
	// 	fixed: [-0.5, -0.5, -0.5, 0.5, -0.3, 0.5],
	// },
	// selection_box: {
	// 	type: Nodeboxtype.fixed,
	// 	fixed: [-0.5, -0.5, -0.5, 0.5, -0.3, 0.5],
	// },
	groups: {
		oddly_breakable_by_hand: 1,
	},
	node_box: {
		type: Nodeboxtype.fixed,
		fixed: [
			// Base plate.
			[-0.5, -0.5, -0.5, 0.5, -6 / 16, 0.5],

			// Left rail.
			[-0.5, -0.5, -0.5, -6 / 16, -2 / 16, 0.5],

			// Right rail.
			[6 / 16, -0.5, -0.5, 0.5, -2 / 16, 0.5],
		],
	},
	// on_construct(position) {
	// 	const it = core.get_node(position);
	// 	print(it.param2);
	// },
});

core.register_node("simple_trains:track_turn", {
	paramtype: ParamType1.light,
	paramtype2: ParamType2["4dir"],
	drawtype: Drawtype.mesh,
	mesh: "track_turn.gltf",
	tiles: ["track_turn.png"],
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
	on_construct(position) {
		const it = core.get_node(position);
		print(it.param2);
	},
});

export const trackStraightID = core.get_content_id(
	"simple_trains:track_straight",
);

export const trackTurnID = core.get_content_id("simple_trains:track_turn");
