import { ShallowVector3 } from "../luanti-api";
import { track } from "./game_detection";
import { trackRegistration, trackStraightID, trackTurnID } from "./track";
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

const __dirToString: string[] = ["north", "east", "south", "west"];
function dirToString(input: DIRECTION): string {
	if (input == DIRECTION.null) {
		return "null";
	}
	return __dirToString[input];
}

/**
 * Track style is what kind of track the locomotive is currently traversing.
 */
enum TRACK_STYLE {
	straight = 0,
	turn = 1,
	incline = 2,
}

enum STRAIGHT_TRACK_AXIS {
	X = 0,
	Z = 1,
}
const STRAIGHT_TRACK_DIR_TO_AXIS: STRAIGHT_TRACK_AXIS[] | null[] = [
	STRAIGHT_TRACK_AXIS.Z,
	STRAIGHT_TRACK_AXIS.X,
	STRAIGHT_TRACK_AXIS.Z,
	STRAIGHT_TRACK_AXIS.X,
];

const dirToVector: Vec3[] | null[] = [
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
 * Direction locomotive is facing.
 * {
 * 	Acceptable param2 outputs. // Direction output index.
 * }
 * If the locomotive does not encounter acceptable it cannot continue.
 *! This is kept here for documentation.
 */
/*
const directionToTurn = [
	// 0 - North.
	{
		1: DIRECTION.east, // 1 - East.
		2: DIRECTION.west, // 3 - West.
	},
	// 1 - East.
	{
		2: DIRECTION.south, // 2 - South.
		3: DIRECTION.north, // 0 - North.
	},
	// 2 - South.
	{
		3: DIRECTION.west, // 3 - West.
		0: DIRECTION.east, // 1 - East.
	},
	// 3 - West.
	{
		0: DIRECTION.north, // 0 - North.
		1: DIRECTION.south, // 2 - South.
	},
];
*/

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
	return id == trackStraightID || id == trackTurnID; // todo: || id == trackSwitchID;
}

/**
 * Calculate the turn trajectory direction from a direction a vehicle is traveling.
 * @param direction The direction the vehicle is traveling.
 * @param trackParam2 The param2 of the track turn.
 * @returns An output direction, or the null direction if failed.
 */
function turnIoCalculation(
	direction: DIRECTION,
	trackParam2: number,
): DIRECTION {
	if ((direction + 1) % 4 == trackParam2) {
		// Right turn.
		return reverseLookupEnum[trackParam2];
	} else if ((direction + 2) % 4 == trackParam2) {
		// Left turn.
		return reverseLookupEnum[(trackParam2 + 1) % 4];
	}

	return DIRECTION.null;
}

//* Unit testing.
// reverseLookupEnum.forEach((dir: DIRECTION) => {
// 	print(dirToString(dir));

// 	for (let i = 0; i < 4; i++) {
// 		const output = turnIoCalculation(dir, i);
// 		if (output != DIRECTION.null) {
// 			print(i, dirToString(output));
// 		}
// 	}
// });

const temp = new Vec3();

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	direction: DIRECTION = DIRECTION.null;
	speed: number = 0.5; // negative is backwards.
	trackStyle: TRACK_STYLE = TRACK_STYLE.straight;

	up: boolean = true;

	onTrack: boolean = false;
	wasOnTrack: boolean = false;

	/**
	 * Lerp forward to backward.
	 * -0.5 - 0.5
	 */
	movementLerp: number = 0;
	vecMovement: Vec3 = new Vec3();

	initial_properties: ObjectProperties = {
		visual: EntityVisual.mesh,
		mesh: "test_train.gltf",
		textures: ["test_train.png"],
		physical: false,
		collide_with_objects: false,
		selectionbox: [-0.2, -0.4, -0.2, 0.2, 0.4, 0.2],
	};

	detectTrackStyle(pos: Vec3): void {
		const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
		if (id == trackStraightID) {
			this.trackStyle = TRACK_STYLE.straight;
		} else if (id == trackTurnID) {
			this.trackStyle = TRACK_STYLE.turn;
		}

		// todo: || id == trackSwitchID;
	}

	on_activate(staticData: string, delta: number): void {
		// todo: check if static data is null.
		// todo: this is debug and can cause issues with trains that already exist.

		this.position = new Vec3();
		this.vecMovement = new Vec3();

		// Position calibration of initial data.
		// Literally nothing else can be done without this, or it may be extremely glitchy and convuluted.
		this.position.setVec(this.object.get_pos()).round();

		if (isTrack(this.position)) {
			this.object.move_to(this.position);
		}

		this.object.set_armor_groups({ punch_activated: 1 });
	}

	on_punch(
		puncher: ObjectRef | null,
		timeFromLastPunch: number | null,
		toolCapabilities: ToolCapabilities | null,
		dir: Vec3 | null,
		damage: number,
	): void {
		this.up = !this.up;

		if (puncher?.is_player() && puncher.get_player_control().sneak) {
			this.object.remove();
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

	updateTrackStyle(pos: Vec3): void {
		const [id, _, param2] = core.get_node_raw(pos.x, pos.y, pos.z);

		if (id == trackStraightID) {
			this.trackStyle = TRACK_STYLE.straight;
		} else if (id == trackTurnID) {
			this.trackStyle = TRACK_STYLE.turn;
		}
		// todo: incline
	}

	canContinue(pos: Vec3): boolean {
		const [id, _, param2] = core.get_node_raw(pos.x, pos.y, pos.z);

		if (id == trackStraightID) {
			const currentAxis = STRAIGHT_TRACK_DIR_TO_AXIS[this.direction];
			const trackAxis = STRAIGHT_TRACK_DIR_TO_AXIS[param2];

			return currentAxis == trackAxis;
		} else if (id == trackTurnID) {
			// todo: this may need to calculate if the locomotive direction is backwards!
			return turnIoCalculation(this.direction, param2) != DIRECTION.null;
		}

		// Todo: detect if the inlet or outlet is in line with the current track when leaving the turn.
		// todo: detect if the inlet or outlet is in line with current track when going from straight to turn.
		// todo: can use the current direction to calculate this combined with the param2 of the turn.

		return false;
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
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
		} else if (id == trackTurnID) {
			// Do nothing.
		} else {
			this.direction = DIRECTION.null;
		}

		//* Movement debug.

		// if (this.up) {
		// 	this.speed += delta;
		// 	if (this.speed >= 1) {
		// 		this.speed = 1;
		// 		this.up = false;
		// 	}
		// } else {
		// 	this.speed -= delta;
		// 	if (this.speed <= -1) {
		// 		this.speed = -1;
		// 		this.up = true;
		// 	}
		// }

		//! Debug
		if (this.up) {
			this.speed = 0.5;
		} else {
			this.speed = -0.5;
		}

		this.movementLerp += delta * this.speed;

		//* This portion is node based environment traversal. (block by block)

		// Backward.
		if (this.movementLerp <= -0.5) {
			this.movementLerp = 0.5;

			const dirVec = dirToVector[this.direction];
			if (dirVec != null) {
				temp.setVec(this.position).subtract(dirVec);
				if (!this.canContinue(temp)) {
					// Hold position.
					this.movementLerp = -0.5;
					this.speed = 0;
				} else {
					// Move backward.
					this.position.setVec(temp);
					this.updateTrackStyle(this.position);
				}
			}
		} else if (this.movementLerp > 0.5) {
			// Forward.
			this.movementLerp = -0.5;

			const dirVec = dirToVector[this.direction];
			if (dirVec != null) {
				temp.setVec(this.position).add(dirVec);
				if (!this.canContinue(temp)) {
					// Hold position.
					this.movementLerp = 0.5;
					this.speed = 0;
				} else {
					// Move forward.
					this.position.setVec(temp);
					this.updateTrackStyle(this.position);
				}
			}
		}

		// if (this.up) {
		// 	this.movementLerp += delta;
		// 	if (this.movementLerp >= 0.5) {
		// 		this.movementLerp = 0.5;
		// 		this.up = false;
		// 	}
		// } else {
		// 	this.movementLerp -= delta;
		// 	if (this.movementLerp <= -0.5) {
		// 		this.movementLerp = -0.5;
		// 		this.up = true;
		// 	}
		// }

		//* Smooth virtual terrain traversal. Makes it appear like it has velocity.

		const lerpVec = new Vec3(
			this.movementLerp,
			this.movementLerp,
			this.movementLerp,
		);

		if (this.trackStyle == TRACK_STYLE.straight) {
			const dirVec = dirToVector[this.direction];

			if (dirVec != null) {
				temp.setVec(dirVec).multiply(lerpVec);

				this.vecMovement.setVec(this.position).add(temp);
				this.object.set_pos(this.vecMovement);
			}
		} else if (this.trackStyle == TRACK_STYLE.turn) {
			const dirVec = dirToVector[this.direction];

			if (dirVec != null) {
				temp.setVec(dirVec).multiply(lerpVec);

				this.vecMovement.setVec(this.position).add(temp);
				this.object.set_pos(this.vecMovement);
			}
		}
	}
}
/**
 * todo: Check turn input using vector direction. If current vector matches that vector then train can go to it.
 * todo: Locomotive's direction can be used to automatically calculate the rotation around a turn based on the param2 of the turn.
 * 0.0 movement lerp in turn would be 45 degrees
 */

registerEntity("simple_trains:train", TestTrain);

// core.register_on_punchnode((pos: ShallowVector3, node: NodeTable) => {
// 	print(dump(node));
// });
