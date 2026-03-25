import { ShallowVector3 } from "../luanti-api";
import { track } from "./game_detection";
import { trackID, trackRegistration } from "./track";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual, LogLevel } from "./utility/enums";
import { degToRad, sign } from "./utility/math";
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
	slope: TRAIN_SLOPE;

	constructor(suc: boolean, pos: Vec3, slo: TRAIN_SLOPE) {
		this.success = suc;
		this.position = pos;
		this.slope = slo;
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

enum TRAIN_SLOPE {
	none = 0,
	up = 1,
	down = 2,
}

function swapTrainSlope(input: TRAIN_SLOPE) {
	if (input == TRAIN_SLOPE.down) {
		return TRAIN_SLOPE.up;
	} else if (input == TRAIN_SLOPE.up) {
		return TRAIN_SLOPE.down;
	}
	return TRAIN_SLOPE.none;
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

function slopeCheck(pos: Vec3, dir: DIRECTION): TRAIN_SLOPE {
	const current = new Vec3().setVec(pos);

	core.add_particle({
		pos: current,
		velocity: new Vec3(0, 2, 0),
		size: 1,
		texture: "default_dirt.png",
	});

	const flatCheck = new Vec3().setVec(current).add(dirToVector[dir]);

	core.add_particle({
		pos: flatCheck,
		velocity: new Vec3(0, 2, 0),
		size: 1,
		texture: "default_wood.png",
	});

	// Train is traveling on flat land.
	if (isTrack(flatCheck)) {
		// print("hit flat");
		return TRAIN_SLOPE.none;
	}

	// Train prefers to go up instead of down from flat.
	const upCheck = new Vec3().setVec(flatCheck).add(new Vec3(0, 1, 0));

	core.add_particle({
		pos: upCheck,
		velocity: new Vec3(0, 2, 0),
		size: 1,
		texture: "default_stone.png",
	});

	if (isTrack(upCheck)) {
		// print("hit up");
		return TRAIN_SLOPE.up;
	}

	// Train then checks if going down.
	const downCheck = new Vec3().setVec(current).subtract(new Vec3(0, 1, 0));
	if (isTrack(downCheck)) {
		// print("hit down");
		return TRAIN_SLOPE.down;
	}

	// Trains are on a slope and try to continue on the slope.

	// Train was on a slope going up and continues to go up.
	const continueUpCheck = new Vec3().setVec(current).add(new Vec3(0, 1, 0));
	if (isTrack(continueUpCheck)) {
		// Now check if another slope exists above that one, the track is flat if not.
		continueUpCheck.add(dirToVector[dir]).add(new Vec3(0, 1, 0));

		if (isTrack(continueUpCheck)) {
			// print("hit continue up");
			return TRAIN_SLOPE.up;
		} else {
			// print("back to flat");
			return TRAIN_SLOPE.none;
		}
	}

	// Train must not be on a slope.
	// print("hit none");
	return TRAIN_SLOPE.none;
}

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	direction: DIRECTION = DIRECTION.north;

	speed: number = 0; // negative is backwards.
	driver: ObjectRef | null = null;

	slope: TRAIN_SLOPE = TRAIN_SLOPE.none;
	oldSlope: TRAIN_SLOPE = TRAIN_SLOPE.none;
	wasOnUphill: boolean = false;

	/**
	 * Lerp forward to backward. (node center to node center)
	 * -1.0 - 1.0
	 */
	movement: number = 0;
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
			this.movement = 0;
			this.speed = 0;
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
		const data = core.deserialize(staticData);

		this.direction = data?.direction || DIRECTION.north;
		this.movement = data?.movement || 0;
		this.speed = data?.speed || 0;

		this.position = new Vec3()
			.setVec(data?.position || this.object.get_pos())
			.round();

		if (data?.position == null && isTrack(this.position)) {
			this.object.move_to(this.position);
		}

		this.object.set_armor_groups({ punch_activated: 1 });
		this.setRotation();
	}

	get_staticdata(): string {
		return core.serialize({
			direction: this.direction,
			movement: this.movement,
			speed: this.speed,
			position: this.position,
		});
	}

	on_punch(
		puncher: ObjectRef | null,
		timeFromLastPunch: number | null,
		toolCapabilities: ToolCapabilities | null,
		dir: Vec3 | null,
		damage: number,
	): void {
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

	setSlope(): void {
		if (this.speed < 0) {
			this.wasOnUphill = this.oldSlope == TRAIN_SLOPE.down;
		} else if (this.speed > 0) {
			this.wasOnUphill = this.oldSlope == TRAIN_SLOPE.up;
		}

		if (this.slope == TRAIN_SLOPE.none) {
			const old = this.object.get_rotation();
			old.x = 0;
			this.object.set_rotation(old);
		} else if (this.slope == TRAIN_SLOPE.up) {
			const old = this.object.get_rotation();
			old.x = math.pi * 0.25;
			this.object.set_rotation(old);
		} else if (this.slope == TRAIN_SLOPE.down) {
			const old = this.object.get_rotation();
			old.x = -math.pi * 0.25;
			this.object.set_rotation(old);
		}
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
		core.add_particle({
			pos: this.position,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_stone.png",
		});

		this.drive(delta);

		if (!isTrack(this.position)) {
			this.speed = 0;
		}

		const oldSign = sign(this.movement);
		const oldMove = this.movement;

		this.movement += delta * this.speed;

		const newSign = sign(this.movement);
		const newMove = this.movement;

		// Do center pass checks for turns.
		// This is in case you change forward to backward (and vice versa) in turns.
		// This also checks to ensure the train doesn't fall off the rails.
		let updateCheck = oldSign != newSign;

		if (this.movement >= 1) {
			this.movement = 1;
		} else if (this.movement <= -1) {
			this.movement = -1;
		}

		// Save the state.
		this.oldSlope = this.slope;

		this.slopeCalculation(oldMove, newMove);

		this.updateCalculation(updateCheck);

		this.nodeMove();

		// this.smoothMove();
	}

	nodeMove(): void {
		if (this.movement == 1) {
			this.movement = 0;
			// print("drive forward!");
			// Train tries to move forwards.
			const straightRes = this.continueStraight(false);
			if (straightRes.success) {
				this.position.setVec(straightRes.position);
				this.object.move_to(this.position);
				// Train moved forwards, but now has to check if it needs to turn.
				if (!this.continueStraight(false).success) {
					const result = this.turn();
					if (result.success) {
						this.direction = result.direction;
						this.setRotation();
					}
				}
			} else {
				// A backup check in the turn logic.
				const result = this.turn();
				if (result.success) {
					this.direction = result.direction;
					this.setRotation();
				} else {
					// Train fell off track.
					this.position.setVec(straightRes.position);
					this.object.move_to(this.position);
				}
			}
		} else if (this.movement == -1) {
			this.movement = 0;
			// print("drive backward!");
			// Train tries to move backwards.
			const straightRes = this.continueStraight(true);
			if (straightRes.success) {
				this.position.setVec(straightRes.position);
				this.object.move_to(this.position);
				// Train moved forwards, but now has to check if it needs to turn.
				if (!this.continueStraight(true).success) {
					const result = this.turn();
					if (result.success) {
						this.direction = directionInversion[result.direction];
						this.setRotation();
					}
				}
			} else {
				// A backup check in the turn logic.
				const result = this.turn();
				if (result.success) {
					this.direction = directionInversion[result.direction];
					this.setRotation();
				} else {
					// Train fell off track.
					this.position.setVec(straightRes.position);
					this.object.move_to(this.position);
				}
			}
		}
	}

	smoothMove(): void {
		const temp = new Vec3().setVec(this.position);
		const dir = new Vec3()
			.setVec(dirToVector[this.direction])
			.multiply(new Vec3(this.movement, this.movement, this.movement));

		if (this.slope != TRAIN_SLOPE.none) {
			const i = this.slope == TRAIN_SLOPE.up ? 1 : -1;
			dir.y += i * this.movement + 0.7;
		}

		// todo: figure out why this is so glitchy
		if (this.slope == TRAIN_SLOPE.none && this.wasOnUphill) {
			dir.y += 1;
		}

		temp.add(dir);
		this.object.set_pos(temp);
	}

	slopeCalculation(oldMove: number, newMove: number): void {
		// Trigger incline checks.
		if (oldMove < 0.5 && newMove >= 0.5) {
			// print("forward (moving forward)");
			// In front of train position.
			// Direction.
			const checker = new Vec3()
				.setVec(this.position)
				.add(dirToVector[this.direction]);

			this.slope = slopeCheck(checker, this.direction);
			this.setSlope();
		} else if (oldMove > 0.5 && newMove <= 0.5) {
			// print("forward (moving backward)");
			// In front of train position.
			// Inverse of direction.
			const checker = new Vec3().setVec(this.position);
			this.slope = swapTrainSlope(
				slopeCheck(checker, directionInversion[this.direction]),
			);
			// If it fails, check in the other direction.
			if (this.slope == TRAIN_SLOPE.none) {
				this.slope = slopeCheck(checker, this.direction);
			}

			this.setSlope();
		} else if (oldMove > -0.5 && newMove <= -0.5) {
			// print("backward (moving backward)");
			// Behind train position.
			// Inverse of direction.
			const checker = new Vec3()
				.setVec(this.position)
				.add(dirToVector[directionInversion[this.direction]]);

			this.slope = swapTrainSlope(
				slopeCheck(checker, directionInversion[this.direction]),
			);
			this.setSlope();
		} else if (oldMove < -0.5 && newMove >= -0.5) {
			// print("backward (moving forward)");
			// Behind train position.
			// Direction.
			const checker = new Vec3().setVec(this.position);
			this.slope = slopeCheck(checker, this.direction);
			// If it fails, check in the other direction.
			if (this.slope == TRAIN_SLOPE.none) {
				this.slope = swapTrainSlope(
					slopeCheck(checker, directionInversion[this.direction]),
				);
			}
			this.setSlope();
		}
	}

	updateCalculation(updateCheck: boolean): void {
		if (!updateCheck) {
			return;
		}
		// print("update check");
		if (this.movement > 0) {
			if (!this.continueStraight(false).success) {
				const result = this.turn();
				if (result.success) {
					// The train can continue.
					this.direction = result.direction;
					this.setRotation();
				} else {
					// The train has hit a path end.
					this.movement = 0;
					this.speed = 0;
					// todo: reset the slope setting! If it hit a path end it cannot be on a slope
				}
			}
		} else {
			if (!this.continueStraight(true).success) {
				const result = this.turn();
				if (result.success) {
					// The train can continue.
					this.direction = directionInversion[result.direction];
					this.setRotation();
				} else {
					// The train has hit a path end.
					this.movement = 0;
					this.speed = 0;
					// todo: reset the slope setting! If it hit a path end it cannot be on a slope
				}
			}
		}
	}

	continueStraight(backward: boolean): StraightResult {
		const dirVector = backward
			? dirToVector[directionInversion[this.direction]]
			: dirToVector[this.direction];

		const forward = new Vec3().setVec(this.position).add(dirVector);
		if (isTrack(forward)) {
			return new StraightResult(true, forward, TRAIN_SLOPE.none);
		}

		const up = new Vec3()
			.setVec(this.position)
			.add(dirVector)
			.add(new Vec3(0, 1, 0));
		if (isTrack(up)) {
			// print("hit up");
			return new StraightResult(true, up, TRAIN_SLOPE.up);
		}

		const down = new Vec3()
			.setVec(this.position)
			.add(dirVector)
			.subtract(new Vec3(0, 1, 0));
		if (isTrack(down)) {
			// print("hit down");
			return new StraightResult(true, down, TRAIN_SLOPE.down);
		}

		return new StraightResult(false, new Vec3(0, 0, 0), TRAIN_SLOPE.none);
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

		return new TurnResult(false, DIRECTION.north);
	}

	drive(delta: number): void {
		if (this.driver == null) {
			return;
		}

		if (this.driver.get_player_control().sneak) {
			print(this.speed);
		}

		if (this.driver.get_player_control().up) {
			if (this.speed < 5) {
				this.speed += delta;
			}
		} else if (this.driver.get_player_control().down) {
			if (this.speed > -5) {
				this.speed -= delta;
			}
		}
	}
}

registerEntity("simple_trains:train", TestTrain);
