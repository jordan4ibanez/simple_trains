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

class StraightResult {
	success: boolean;
	position: Vec3;

	constructor(suc: boolean, pos: Vec3) {
		this.success = suc;
		this.position = pos;
	}
}

class TurnResult {
	success: boolean;
	direction: DIRECTION;

	constructor(suc: boolean, dir: DIRECTION) {
		this.success = suc;
		this.direction = dir;
	}
}

enum STATE {
	idle = 0,
	rolling = 1,
	halted = 2,
}
enum DIRECTION {
	north = 0, // +Z
	east = 1, //  +X
	south = 2, // -Z
	west = 3, //  -X
}

const __dirToString: string[] = ["north", "east", "south", "west"];
function dirToString(input: DIRECTION): string {
	return __dirToString[input];
}

enum AXIS {
	X = 0,
	Z = 1,
}

const DIR_TO_AXIS: AXIS[] = [AXIS.Z, AXIS.X, AXIS.Z, AXIS.X];

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
 * Each direction's opposite.
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
	direction: DIRECTION = DIRECTION.north;

	speed: number = 0.5; // negative is backwards.

	debugTimer = 0;
	debugForward = 0.5;
	debugBackward = 0.6;

	up: boolean = true;

	driver: ObjectRef | null = null;

	// onTrack: boolean = false;
	// wasOnTrack: boolean = false;

	/**
	 * Lerp forward to backward. (node center to node center)
	 * -1.0 - 1.0
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

		// Rotate the locomotive with sneak rightclick.
		if (clicker.get_player_control().sneak) {
			this.direction = (this.direction + 1) % 4;
			this.setRotation();
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
		if (staticData.length > 0) {
			const data = core.deserialize(staticData);

			if (typeof data.direction == "number") {
				this.direction = data.direction;
				print("direction restored");
			}
		}

		this.position = new Vec3();
		// this.vecMovement = new Vec3();

		this.position.setVec(this.object.get_pos()).round();

		if (isTrack(this.position)) {
			this.object.move_to(this.position);
		}

		this.object.set_armor_groups({ punch_activated: 1 });
		this.setRotation();
	}

	get_staticdata(): string {
		return core.serialize({ direction: this.direction });
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
		this.object.set_yaw(this.direction * -90 * degToRad);
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
		core.add_particle({
			pos: this.position,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_stone.png",
		});

		this.drive();

		// Todo: use this same logic when the locomotive goes past the 0 point.
		// if was 0.1 and now -0.1 or vice versa.

		if (this.debugTimer == this.debugForward) {
			print("drive forward!");
			const straightRes = this.continueStraight(false);

			if (straightRes.success) {
				this.position.setVec(straightRes.position);
				this.object.move_to(this.position);
			} else {
				const result = this.turn();
				if (result.success) {
					this.direction = result.direction;
					this.setRotation();
				}
			}
		} else if (this.debugTimer == this.debugBackward) {
			print("drive backward!");
			const straightRes = this.continueStraight(true);

			if (straightRes.success) {
				this.position.setVec(straightRes.position);
				this.object.move_to(this.position);
			} else {
				const result = this.turn();

				if (result.success) {
					this.direction = directionInversion[result.direction];
					this.setRotation();
				}
			}
		}
		this.debugTimer -= delta;
	}

	continueStraight(backward: boolean): StraightResult {
		const dirVector = backward
			? dirToVector[directionInversion[this.direction]]
			: dirToVector[this.direction];
		const forward = new Vec3().setVec(this.position).add(dirVector);
		return new StraightResult(isTrack(forward), forward);
	}

	/**
	 * Train tries to turn.
	 * @returns Success.
	 */
	turn(): TurnResult {
		const avoid = this.direction;

		const avoidAxis = DIR_TO_AXIS[avoid];

		// todo: This can detect if there's a switch lever ahead.

		const temp = new Vec3().setVec(this.position);

		if (avoidAxis == AXIS.X) {
			// Try to go north or south.
			temp.add(dirToVector[DIRECTION.north]);
			if (isTrack(temp)) {
				return new TurnResult(true, DIRECTION.north);
			}
			temp.setVec(this.position).add(dirToVector[DIRECTION.south]);
			if (isTrack(temp)) {
				return new TurnResult(true, DIRECTION.south);
			}
		} else {
			// Try to go east or west.
			temp.add(dirToVector[DIRECTION.east]);
			if (isTrack(temp)) {
				return new TurnResult(true, DIRECTION.east);
			}
			temp.setVec(this.position).add(dirToVector[DIRECTION.west]);
			if (isTrack(temp)) {
				return new TurnResult(true, DIRECTION.west);
			}
		}

		//! note: This will try to pick a direction to head into.
		//! Can probably just use the current axis and pick 2 other directions from the other axis.

		return new TurnResult(false, DIRECTION.north);
	}

	drive(): void {
		if (this.driver == null) {
			return;
		}
		if (this.debugTimer > 0) {
			return;
		}

		if (this.driver.get_player_control().up) {
			this.debugTimer = this.debugForward;
		} else if (this.driver.get_player_control().down) {
			this.debugTimer = this.debugBackward;
		}
	}
}

registerEntity("simple_trains:train", TestTrain);
