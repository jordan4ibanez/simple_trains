import { ShallowVector3 } from "../luanti-api";
import { track } from "./game_detection";
import { trackID, trackRegistration } from "./track";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual, LogLevel } from "./utility/enums";
import { degToRad, sign } from "./utility/math";
import { Vec3 } from "./utility/vector";

trackRegistration();

const DEBUG_MODE = true;

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

class TrackStatus {
	valid: boolean = false;
	position: Vec3 = new Vec3();

	disable(): void {
		this.valid = false;
		this.position.set(0, 0, 0);
	}

	enable(newValue: Vec3): void {
		this.valid = true;
		this.position.setVec(newValue);
	}
}

enum TRAIN_SLOPE {
	none = 0,
	up = 1,
	down = 2,
	flat_to_up = 3,
	flat_to_down = 4,
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

// Special for __findTrack.
const __yPosOrder = [0, 1, -2];

/**
 * Check if a position is track.
 * @param pos A position.
 * @returns If it is track.
 */
function isTrack(pos: Vec3): boolean {
	const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
	return id == trackID;
}

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	direction: DIRECTION = DIRECTION.north;

	checkEnvironmentTimer: number = 0;
	front: TrackStatus = new TrackStatus();
	// 2 nodes in front.
	lookAhead: TrackStatus = new TrackStatus();
	back: TrackStatus = new TrackStatus();
	// 2 nodes behind.
	lookBehind: TrackStatus = new TrackStatus();

	speed: number = 0; // negative is backwards.
	driver: ObjectRef | null = null;

	slope: TRAIN_SLOPE = TRAIN_SLOPE.none;

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

		if (data != null) {
			this.direction = data.direction || DIRECTION.north;
			this.movement = data.movement || 0;
			this.speed = data.speed || 0;

			this.position = new Vec3()
				.setVec(data.position || this.object.get_pos())
				.round();

			if (data.position == null && isTrack(this.position)) {
				this.object.move_to(this.position);
			}

			this.front = new TrackStatus();
			if (data.frontPosition != null) {
				this.front.enable(data.frontPosition);
			}
			this.lookAhead = new TrackStatus();
			if (data.lookAheadPosition != null) {
				this.lookAhead.enable(data.lookAheadPosition);
			}

			this.back = new TrackStatus();
			if (data.backPosition != null) {
				this.back.enable(data.backPosition);
			}
			this.lookBehind = new TrackStatus();
			if (data.lookBehindPosition != null) {
				this.lookBehind.enable(data.lookBehindPosition);
			}

			this.checkEnvironmentTimer = data?.checkEnvironmentTimer || 0;
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
			frontPosition: this.front.position,
			lookAheadPosition: this.lookAhead.position,
			backPosition: this.back.position,
			lookBehindPosition: this.lookBehind.position,
			checkEnvironmentTimer: this.checkEnvironmentTimer,
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

		this.checkEnvironmentTimer += delta;

		if (this.checkEnvironmentTimer > 0.25) {
			this.checkEnvironmentTimer -= 0.25;
			// this.calculateFrontBackTrack();
		}

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

		// if (!DEBUG_MODE) {
		this.slopeCalculation(oldMove, newMove);
		// }

		this.updateCalculation(updateCheck);

		this.nodeMove();

		// if (!DEBUG_MODE) {
		this.smoothMove();
		// }
	}

	// This mutates pos as a result.
	__findTrack(pos: Vec3): boolean {
		for (let y of __yPosOrder) {
			pos.y += y;
			if (isTrack(pos)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * This is specifically designed only for moving forward and backward
	 * in a straight line.
	 * Turning is done as a failure of the ability to move in a straight line.
	 * This is specifically for the ability to traverse up and down slopes
	 * as a side effect.
	 * ! Do not add turning to this !
	 */
	calculateFrontBackTrack(): void {
		const front = new Vec3()
			.setVec(this.position)
			.add(dirToVector[this.direction]);

		const lookAhead = new Vec3()
			.setVec(this.position)
			.add(dirToVector[this.direction])
			.add(dirToVector[this.direction]);

		const back = new Vec3()
			.setVec(this.position)
			.subtract(dirToVector[this.direction]);

		const lookBehind = new Vec3()
			.setVec(this.position)
			.subtract(dirToVector[this.direction])
			.subtract(dirToVector[this.direction]);

		this.front.disable();
		this.lookAhead.disable();
		this.back.disable();
		this.lookBehind.disable();

		if (this.__findTrack(front)) {
			this.front.enable(front);
		}

		if (this.__findTrack(lookAhead)) {
			this.lookAhead.enable(lookAhead);
		}

		if (this.__findTrack(back)) {
			this.back.enable(back);
		}

		if (this.__findTrack(lookBehind)) {
			this.lookBehind.enable(lookBehind);
		}

		//! Debug front.
		if (this.front.valid) {
			core.add_particle({
				pos: this.front.position,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_stone.png",
			});
		}
		if (this.lookAhead.valid) {
			core.add_particle({
				pos: this.lookAhead.position,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_stone.png",
			});
		}

		//! Debug back.
		if (this.back.valid) {
			core.add_particle({
				pos: this.back.position,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_wood.png",
			});
		}
		if (this.lookBehind.valid) {
			core.add_particle({
				pos: this.lookBehind.position,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_stone.png",
			});
		}

		// print("calculate!");
	}

	nodeMove(): void {
		if (this.movement == 1) {
			this.calculateFrontBackTrack();
			this.movement = 0;
			// print("drive forward!");
			// Train tries to move forwards.
			if (this.front.valid) {
				this.position.setVec(this.front.position);
				this.object.move_to(this.position);
				this.calculateFrontBackTrack();
				// Train moved forwards, but now has to check if it needs to turn.
				if (!this.front.valid) {
					const result = this.turn();
					if (result.success) {
						this.direction = result.direction;
						this.setRotation();
						this.calculateFrontBackTrack();
					}
				}
			} else {
				// A backup check in the turn logic.
				const result = this.turn();
				if (result.success) {
					this.direction = result.direction;
					this.setRotation();
					this.calculateFrontBackTrack();
				} else {
					// Train fell off track.
					print("train fell off track forward?");
					// this.position.setVec(straightRes.position);
					// this.object.move_to(this.position);
				}
			}
		} else if (this.movement == -1) {
			this.calculateFrontBackTrack();
			this.movement = 0;
			// print("drive backward!");
			// Train tries to move backwards.
			if (this.back.valid) {
				this.position.setVec(this.back.position);
				this.object.move_to(this.position);
				this.calculateFrontBackTrack();
				// Train moved forwards, but now has to check if it needs to turn.
				if (!this.back.valid) {
					const result = this.turn();
					if (result.success) {
						this.direction = directionInversion[result.direction];
						this.setRotation();
						this.calculateFrontBackTrack();
					}
				}
			} else {
				// A backup check in the turn logic.
				const result = this.turn();
				if (result.success) {
					this.direction = directionInversion[result.direction];
					this.setRotation();
					this.calculateFrontBackTrack();
				} else {
					// Train fell off track.
					print("train fell off the track backward?");
					// this.position.setVec(straightRes.position);
					// this.object.move_to(this.position);
				}
			}
		}
	}

	smoothMove(): void {
		const temp = new Vec3().setVec(this.position);
		const dir = new Vec3()
			.setVec(dirToVector[this.direction])
			.multiply(new Vec3(this.movement, this.movement, this.movement));

		// if (this.slope != TRAIN_SLOPE.none) {
		// 	const i = this.slope == TRAIN_SLOPE.up ? 1 : -1;
		// 	dir.y += i * this.movement + 0.7;
		// }

		// todo: figure out why this is so glitchy
		// if (this.slope == TRAIN_SLOPE.none && this.wasOnUphill) {
		// 	dir.y += 1;
		// }

		temp.add(dir);
		this.object.set_pos(temp);
	}

	slopeCalculation(oldMove: number, newMove: number): void {
		// Trigger incline checks.
		if (oldMove < 0.5 && newMove >= 0.5) {
			print("forward (moving forward)");
			// In front of train position.
			// Direction.

			if (this.front.valid) {
				if (this.front.position.y == this.position.y) {
					if (this.lookAhead.valid) {
						// Going from flat to slope.
						if (this.lookAhead.position.y > this.front.position.y) {
							print(1);
							this.slope = TRAIN_SLOPE.flat_to_up;
						} else {
							print(2);
							this.slope = TRAIN_SLOPE.none;
						}
					} else {
						print(3);
						this.slope = TRAIN_SLOPE.none;
					}
				} else if (this.front.position.y > this.position.y) {
					print(4);
					this.slope = TRAIN_SLOPE.up;
				}
			} else {
				print(5);
				this.slope = TRAIN_SLOPE.none;
			}

			// const checker = new Vec3()
			// 	.setVec(this.position)
			// 	.add(dirToVector[this.direction]);

			// this.slope = slopeCheck(checker, this.direction);
			// this.setSlope();
		} else if (oldMove > 0.5 && newMove <= 0.5) {
			// print("forward (moving backward)");
			// In front of train position.
			// Inverse of direction.
			// const checker = new Vec3().setVec(this.position);
			// this.slope = swapTrainSlope(
			// 	slopeCheck(checker, directionInversion[this.direction]),
			// );
			// // If it fails, check in the other direction.
			// if (this.slope == TRAIN_SLOPE.none) {
			// 	this.slope = slopeCheck(checker, this.direction);
			// }
			// this.setSlope();
		} else if (oldMove > -0.5 && newMove <= -0.5) {
			// print("backward (moving backward)");
			// Behind train position.
			// Inverse of direction.
			// const checker = new Vec3()
			// 	.setVec(this.position)
			// 	.add(dirToVector[directionInversion[this.direction]]);
			// this.slope = swapTrainSlope(
			// 	slopeCheck(checker, directionInversion[this.direction]),
			// );
			// this.setSlope();
		} else if (oldMove < -0.5 && newMove >= -0.5) {
			// print("backward (moving forward)");
			// Behind train position.
			// Direction.
			// const checker = new Vec3().setVec(this.position);
			// this.slope = slopeCheck(checker, this.direction);
			// // If it fails, check in the other direction.
			// if (this.slope == TRAIN_SLOPE.none) {
			// 	this.slope = swapTrainSlope(
			// 		slopeCheck(checker, directionInversion[this.direction]),
			// 	);
			// }
			// this.setSlope();
		}
		this.setSlope();
	}

	updateCalculation(updateCheck: boolean): void {
		if (!updateCheck) {
			return;
		}
		// print("update check");
		if (this.movement > 0) {
			this.calculateFrontBackTrack();
			if (!this.front.valid) {
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
			this.calculateFrontBackTrack();
			if (!this.back.valid) {
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

		if (DEBUG_MODE) {
			if (this.driver.get_player_control().up) {
				this.speed = 2;
			} else if (this.driver.get_player_control().down) {
				this.speed = -2;
			} else {
				this.speed = 0;
			}
		} else {
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
}

registerEntity("simple_trains:train", TestTrain);
