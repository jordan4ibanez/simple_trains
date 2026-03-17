import { ShallowVector3 } from "../luanti-api";
import { track } from "./game_detection";
import { trackRegistration, trackStraightID } from "./track";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual } from "./utility/enums";
import { degToRad } from "./utility/math";
import { Vec3 } from "./utility/vector";

trackRegistration();

core.register_chatcommand("t", {
	func: (name: string) => {
		const player = core.get_player_by_name(name);
		if (player == null) {
			return;
		}
		const pos = player.get_pos();
		pos.y += 0.5;

		const [id] = core.get_node_raw(pos.x, pos.y, pos.z);

		if (id == trackStraightID) {
			core.add_entity(pos, "simple_trains:train");
		}
	},
});

enum STATE {
	idle = 0,
	rolling = 1,
	halted = 2,
}
enum DIRECTION {
	null = -1,
	north = 0, // +Z
	east = 1, //  +X
	south = 2, // -Z
	west = 3, //  -X
}

enum STRAIGHT_TRACK_AXIS {
	X = 0,
	Z = 1,
}
const STRAIGHT_TRACK_DIR_TO_AXIS: STRAIGHT_TRACK_AXIS[] = [
	STRAIGHT_TRACK_AXIS.Z,
	STRAIGHT_TRACK_AXIS.X,
	STRAIGHT_TRACK_AXIS.Z,
	STRAIGHT_TRACK_AXIS.X,
];

const dirToVector: Vec3[] = [
	new Vec3(0, 0, 1), //  0 - North.
	new Vec3(1, 0, 0), //  1 - East.
	new Vec3(0, 0, -1), // 2 - South.
	new Vec3(-1, 0, 0), // 3 - West.
];

/**
 * Convert a direction index into an enum.
 */
const reverseLookupEnum = [
	DIRECTION.north,
	DIRECTION.east,
	DIRECTION.south,
	DIRECTION.west,
];

/**
 * This is set up so the train doesn't turn backwards when turning.
 */
const directionInversion: DIRECTION[] = [
	DIRECTION.south, // 0 - 2
	DIRECTION.west, //  1 - 3
	DIRECTION.north, // 2 - 0
	DIRECTION.east, //  3 - 1
];

/**
 * Check if a position is track.
 * @param pos A position.
 * @returns If it is track.
 */
function isTrack(pos: Vec3): boolean {
	const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
	return id == trackStraightID; // todo: || id == trackTurnID || id == trackSwitchID;
}

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	direction: DIRECTION = DIRECTION.null;

	onTrack: boolean = false;
	wasOnTrack: boolean = false;

	/**
	 * Lerp forward to backward.
	 * -1.0 - 1.0
	 */
	movementLerp: number = 0;
	vecMovement: Vec3 = new Vec3();

	speed: number = 0;

	up: boolean = true;

	initial_properties: ObjectProperties = {
		visual: EntityVisual.mesh,
		mesh: "test_train.gltf",
		textures: ["test_train.png"],
		physical: false,
		collide_with_objects: false,
		selectionbox: [-0.2, -0.4, -0.2, 0.2, 0.4, 0.2],
	};

	on_activate(staticData: string, delta: number): void {
		// todo: check if static data is null.
		// todo: this is debug and can cause issues with trains that already exist.

		this.position = new Vec3();

		// Position calibration of initial data.
		// Literally nothing else can be done without this, or it may be extremely glitchy and convuluted.
		this.position.setVec(this.object.get_pos()).round();

		if (isTrack(this.position)) {
			this.object.move_to(this.position);
		}
	}

	/**
	 * Set the locomotive's rotation.
	 */
	setRotation(): void {
		if (this.direction == DIRECTION.null) {
			this.object.set_yaw(DIRECTION.north * -90 * degToRad);
		} else {
			this.object.set_yaw(this.direction * -90 * degToRad);
		}
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
		this.speed += delta;

		core.add_particle({
			pos: this.position,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_stone.png",
		});
		const [id, _, param2] = core.get_node_raw(
			this.position.x,
			this.position.y,
			this.position.z,
		);

		if (id == trackStraightID) {
			// Try to configure an initial direction.
			if (this.direction == DIRECTION.null) {
				const axis = STRAIGHT_TRACK_DIR_TO_AXIS[param2];

				if (axis == STRAIGHT_TRACK_AXIS.X) {
					this.direction = DIRECTION.east;
				} else {
					this.direction = DIRECTION.north;
				}

				this.setRotation();
			}
		} else {
			this.direction = DIRECTION.null;
		}
	}
}

registerEntity("simple_trains:train", TestTrain);

// core.register_on_punchnode((pos: ShallowVector3, node: NodeTable) => {
// 	print(dump(node));
// });
