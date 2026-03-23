import { ShallowVector3 } from "../luanti-api";
import { track } from "./game_detection";
import { trackID, trackRegistration } from "./track";
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

		if (id == trackID) {
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
	return id == trackID;
}

const temp = new Vec3();

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	direction: DIRECTION = DIRECTION.null;

	speed: number = 0.5; // negative is backwards.

	up: boolean = true;

	driver: ObjectRef | null = null;

	// onTrack: boolean = false;
	// wasOnTrack: boolean = false;

	/**
	 * Lerp forward to backward.
	 * -0.5 - 0.5
	 */
	// movementLerp: number = 0;
	// vecMovement: Vec3 = new Vec3();

	initial_properties: ObjectProperties = {
		visual: EntityVisual.mesh,
		mesh: "test_train.gltf",
		textures: ["test_train.png"],
		physical: false,
		collide_with_objects: false,
		selectionbox: [-0.2, -0.4, -0.2, 0.2, 0.4, 0.2],
	};

	on_rightclick(clicker: ObjectRef): void {
		if (!clicker.is_player()) {
			return;
		}

		const data = this.object.get_children();

		if (data.length > 0) {
			this.driver = null;
			data.forEach((thing) => {
				thing.set_detach();
			});
			return;
		}

		this.driver = clicker;
		clicker.set_attach(
			this.object,
			"",
			new Vec3(0, 0, 0),
			new Vec3(0, 0, 0),
		);
	}

	on_activate(staticData: string, delta: number): void {
		// todo: check if static data is null.
		// todo: this is debug and can cause issues with trains that already exist.

		this.position = new Vec3();
		// this.vecMovement = new Vec3();

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
	 * Set the locomotive's rotation. Used for straight.
	 */
	setRotation(): void {
		if (this.direction == DIRECTION.null) {
			this.object.set_yaw(DIRECTION.north * -90 * degToRad);
		} else {
			this.object.set_yaw(this.direction * -90 * degToRad);
		}
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
		core.add_particle({
			pos: this.position,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_stone.png",
		});
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
