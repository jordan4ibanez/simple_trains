import { ShallowVector3 } from "../luanti-api";
import { __playerAnimationFunction, __trackIdentity } from "./game_detection";
import { Entity, registerEntity, SelectionBox } from "./utility/entity";
import { EntityVisual, LogLevel } from "./utility/enums";
import { degToRad, sign } from "./utility/math";
import { Vec3 } from "./utility/vector";

const DEBUG_MODE = true;

const trackIDs = __trackIdentity;
const setAnimation = __playerAnimationFunction;

core.register_chatcommand("t", {
	func: (name: string) => {
		const player = core.get_player_by_name(name);
		if (player == null) {
			return;
		}
		const pos = player.get_pos();
		pos.y += 0.5;

		const [id] = core.get_node_raw(pos.x, pos.y, pos.z);

		if (id == trackIDs.normal) {
			core.add_entity(pos, "simple_trains:0_3_0_tank_engine");
		}
	},
});

function isRailVehicle(obj: ObjectRef): boolean {
	if (obj.is_player()) {
		return false;
	}
	const luaEnt = obj.get_luaentity();
	if (luaEnt == null) {
		return false;
	}
	return (luaEnt as any).simple_train_uuid != null;
}

namespace STUUID {
	const id = "__s_train_uuid_ref_data";
	const modStorage = core.get_mod_storage();
	let nextUUID = modStorage.get_int(id);
	export function giveUUID(): number {
		const st = nextUUID;
		nextUUID += 1;
		modStorage.set_int(id, nextUUID);
		return st;
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
	flat = 0,
	up = 1,
	down = 2,
}

enum DIRECTION {
	north = 0, // +Z
	east = 1, //  +X
	south = 2, // -Z
	west = 3, //  -X
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
	return (
		id == trackIDs.normal || id == trackIDs.booster || id == trackIDs.brake
	);
}

function isBoost(pos: Vec3): boolean {
	if (trackIDs.booster == null) {
		return false;
	}
	const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
	return id == trackIDs.booster;
}

function isBrake(pos: Vec3): boolean {
	if (trackIDs.brake == null) {
		return false;
	}
	const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
	return id == trackIDs.brake;
}

function registerRailVehicle(definition?: VehicleDefinition): void {
	const sBox = definition?.collisionBox || new Vec3(1, 1, 1);

	class RailVehicle extends Entity {
		simple_train_uuid?: number;
		position: Vec3 = new Vec3();
		direction: DIRECTION = DIRECTION.north;

		checkEnvironmentTimer: number = 0;
		front: TrackStatus = new TrackStatus();
		back: TrackStatus = new TrackStatus();

		speed: number = 0; // negative is backwards.
		driver: ObjectRef | null = null;
		topSpeed: number = definition?.topSpeed || 10;

		slope: TRAIN_SLOPE = TRAIN_SLOPE.flat;

		boosted: boolean = false;
		braked: boolean = false;

		/**
		 * Lerp forward to backward. (node edge to node edge)
		 * -0.5 - 0.5
		 */
		movement: number = 0;

		// Defineable components.
		powered: boolean = definition?.powered || false;
		rideable: boolean = definition?.rideable || false;
		size: number = definition?.size || 1;
		animSpeed = definition?.animationSpeed || 1;

		initial_properties: ObjectProperties = {
			visual: EntityVisual.mesh,
			mesh: definition?.mesh,
			textures: definition?.textures,
			physical: false,
			collide_with_objects: false,
			collisionbox: [
				-sBox.x + 0.5,
				-0.5,
				-sBox.z + 0.5,
				sBox.x - 0.5,
				-0.5 + sBox.y,
				sBox.z - 0.5,
			],
			selectionbox: new SelectionBox(
				[
					-sBox.x + 0.5,
					-0.5,
					-sBox.z + 0.5,
					sBox.x - 0.5,
					-0.5 + sBox.y,
					sBox.z - 0.5,
				],
				true,
			),
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
					if (thing.is_player()) {
						setAnimation(thing, "stand");
						// fixme: this should probably save the old one in memory.
						clicker.set_eye_offset(
							new Vec3(0, 0, 0),
							new Vec3(0, 0, 0),
							new Vec3(0, 0, 0),
						);
					}
				});
				return;
			}

			// Rotate the locomotive with sneak rightclick.
			if (clicker.get_player_control().sneak) {
				this.movement = 0;
				this.direction = (this.direction + 1) % 4;
				this.setRotation();
				this.calculateFrontBackTrack();
				this.slopeCalculation();
				this.setSlope();
				return;
			}

			this.driver = clicker;
			clicker.set_attach(
				this.object,
				"",
				definition?.seatingOffset || new Vec3(0, 0, 0),
				new Vec3(0, 0, 0),
			);
			setAnimation(clicker, "sit");
			if (definition?.eyeOffset != null) {
				clicker.set_eye_offset(
					definition.eyeOffset,
					definition.eyeOffset,
					definition.eyeOffset,
				);
			}
		}

		on_activate(staticData: string, delta: number): void {
			const data = core.deserialize(staticData);

			if (data != null) {
				this.direction = data.direction || DIRECTION.north;
				this.movement = data.movement || 0;
				this.speed = data.speed || 0;
				this.slope = data.slope || TRAIN_SLOPE.flat;

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

				this.back = new TrackStatus();
				if (data.backPosition != null) {
					this.back.enable(data.backPosition);
				}

				this.checkEnvironmentTimer = data?.checkEnvironmentTimer || 0;
			} else {
				this.position = new Vec3()
					.setVec(this.object.get_pos())
					.round();
			}
			this.simple_train_uuid =
				data?.simple_train_uuid || STUUID.giveUUID();

			this.object.set_armor_groups({ punch_activated: 1 });
			this.setRotation();
			this.setSlope();

			this.object.set_animation({ x: 0, y: 1 }, this.speed, 0, true);
		}

		get_staticdata(): string {
			return core.serialize({
				direction: this.direction,
				movement: this.movement,
				speed: this.speed,
				slope: this.slope,
				position: this.position,
				frontPosition: this.front.position,
				backPosition: this.back.position,
				checkEnvironmentTimer: this.checkEnvironmentTimer,
				simple_train_uuid: this.simple_train_uuid,
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
			if (this.slope == TRAIN_SLOPE.flat) {
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

			// todo: Check if in train before limiting.
			if (math.abs(this.speed) > this.topSpeed) {
				const multiplicitive = sign(this.speed);
				this.speed = this.topSpeed * multiplicitive;
			}

			if (this.speed == 0) {
				this.checkEnvironmentTimer += delta;

				if (this.checkEnvironmentTimer > 0.5) {
					this.checkEnvironmentTimer -= 0.5;
					this.calculateFrontBackTrack();
					this.slopeCalculation();
					this.setSlope();
				}
			}

			if (!isTrack(this.position)) {
				this.speed = 0;
			} else {
				this.boosted = false;
				this.braked = false;
				if (isBoost(this.position)) {
					this.boosted = true;
				} else if (isBrake(this.position)) {
					this.braked = true;
				}
			}

			const oldSign = sign(this.movement);

			this.movement += delta * this.speed;

			const newSign = sign(this.movement);

			// Do center pass checks for turns.
			// This is in case you change forward to backward (and vice versa) in turns.
			// This also checks to ensure the train doesn't fall off the rails.
			let updateCheck = oldSign != newSign;

			if (this.movement >= 0.5) {
				this.movement = 0.5;
			} else if (this.movement <= -0.5) {
				this.movement = -0.5;
			}

			this.updateCalculation(updateCheck);

			this.smoothMove();

			this.nodeMove();

			this.updateAnimation();
		}

		updateAnimation(): void {
			this.object.set_animation_frame_speed(this.speed * this.animSpeed);
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

			const back = new Vec3()
				.setVec(this.position)
				.subtract(dirToVector[this.direction]);

			this.front.disable();
			this.back.disable();

			if (this.__findTrack(front)) {
				this.front.enable(front);
			}

			if (this.__findTrack(back)) {
				this.back.enable(back);
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

			//! Debug back.
			if (this.back.valid) {
				core.add_particle({
					pos: this.back.position,
					velocity: new Vec3(0, 2, 0),
					size: 1,
					texture: "default_wood.png",
				});
			}
		}

		nodeMove(): void {
			// todo: remove turning from here!!
			if (this.movement == 0.5) {
				this.calculateFrontBackTrack();
				this.movement = -0.49;
				// print("drive forward!");
				// Train tries to move forwards.
				if (this.front.valid) {
					this.position.setVec(this.front.position);
					this.calculateFrontBackTrack();
				}
				this.slopeCalculation();
			} else if (this.movement == -0.5) {
				this.calculateFrontBackTrack();
				this.movement = 0.49;
				// print("drive backward!");
				// Train tries to move backwards.
				if (this.back.valid) {
					this.position.setVec(this.back.position);
					this.calculateFrontBackTrack();
				}
				this.slopeCalculation();
			}
		}

		smoothMove(): void {
			const temp = new Vec3().setVec(this.position);
			const dir = new Vec3()
				.setVec(dirToVector[this.direction])
				.multiply(
					new Vec3(this.movement, this.movement, this.movement),
				);

			// This overshoots by 0.2 and makes a slope transition jolt.
			// But I do not think it is fixable.

			if (this.slope == TRAIN_SLOPE.up) {
				dir.y += this.movement + 0.7;
			} else if (this.slope == TRAIN_SLOPE.down) {
				dir.y -= this.movement - 0.7;
			}

			temp.add(dir);
			this.object.set_pos(temp);
		}

		slopeCalculation(): void {
			if (this.front.valid) {
				if (this.front.position.y > this.position.y) {
					this.slope = TRAIN_SLOPE.up;
					this.setSlope();
					return;
				}
			}
			if (this.back.valid) {
				if (this.back.position.y > this.position.y) {
					this.slope = TRAIN_SLOPE.down;
					this.setSlope();
					return;
				}
			}

			this.slope = TRAIN_SLOPE.flat;
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
					}
				}
			}
			this.slopeCalculation();
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
			if (this.powered) {
				// A powered vehicle.
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
			} else {
				// An unpowered vehicle.

				// todo: Check if this is in a train before applying gravity, friction, and powered rail.

				if (this.boosted) {
					// Booster.
					const multiplicitive = sign(this.speed);
					this.speed += delta * 15 * multiplicitive;
				} else if (this.braked) {
					// Brake.
					const multiplicitive = sign(this.speed) * -1;
					if (multiplicitive != 0) {
						this.speed += delta * multiplicitive * 12;
						if (math.abs(this.speed) < 0.1) {
							this.speed = 0;
						}
					}
				}

				let collision = false;

				const pos = new Vec3().setVec(this.object.get_pos());

				// Magnetic collision with entities.
				for (const obj of core.get_objects_inside_radius(
					pos,
					this.size,
				)) {
					if (obj == this.object) {
						continue;
					}
					// todo: Add option for mobs too.
					if (obj.is_player() || isRailVehicle(obj)) {
						if (obj == this.driver) {
							continue;
						}

						collision = true;

						const otherPos = obj.get_pos();

						const output = new Vec3()
							.setVec(pos)
							.subtract(otherPos);

						const calcForce = (axisValue: number) => {
							// Sign.
							const s = sign(axisValue);
							// Abs.
							const a = math.abs(axisValue);
							// Product.
							const p = this.size - a;
							// Result.
							let r = p * s;

							// 2 vehicles are in same position.
							if (r == 0) {
								r = math.random() * math.random(-1, 1);
							}

							// print(r, "a");
							return r * 25 * delta;
						};

						if (DIR_TO_AXIS[this.direction] == AXIS.X) {
							if (this.direction == DIRECTION.east) {
								this.speed += calcForce(output.x);
							} else {
								this.speed -= calcForce(output.x);
							}
						} else {
							if (this.direction == DIRECTION.north) {
								this.speed += calcForce(output.z);
							} else {
								this.speed -= calcForce(output.z);
							}
						}
					}
				}

				// Gravity.
				if (this.slope == TRAIN_SLOPE.down) {
					this.speed += delta * 10;
				} else if (this.slope == TRAIN_SLOPE.up) {
					this.speed -= delta * 10;
				} else {
					// Friction.
					if (!collision) {
						const multiplicitive = sign(this.speed) * -1;
						if (multiplicitive != 0) {
							this.speed += delta * multiplicitive * 1.5;
							if (math.abs(this.speed) < 0.1) {
								this.speed = 0;
							}
						}
					}
				}
			}
		}
	}

	registerEntity(definition?.name || "", RailVehicle);
}

class VehicleDefinition {
	name?: string = undefined;
	powered?: boolean = false;
	topSpeed?: number = 10;
	rideable?: boolean = false;
	// radius from center size. Used for collision detection.
	size?: number = 1.5;
	// X and Z are the widths. (total)
	// Y is the height of the vehicle. (total)
	collisionBox?: ShallowVector3 = new Vec3(1, 1, 1);
	mesh?: string = "";
	textures?: string[] = [""];
	seatingOffset?: ShallowVector3 = new Vec3(0, 0, 0);
	eyeOffset?: ShallowVector3 = new Vec3(0, 0, 0);
	animationSpeed?: number = 1;
}

const minecart = new VehicleDefinition();
minecart.name = "simple_trains:minecart";
minecart.mesh = "simple_minecart.gltf";
minecart.textures = ["simple_minecart.png"];
registerRailVehicle(minecart);

const tank_engine_0_3_0 = new VehicleDefinition();
tank_engine_0_3_0.name = "simple_trains:0_3_0_tank_engine";
tank_engine_0_3_0.mesh = "0_3_0_tank_engine.gltf";
tank_engine_0_3_0.textures = ["0_3_0_tank_engine.png"];
tank_engine_0_3_0.powered = true;
tank_engine_0_3_0.seatingOffset = new Vec3(0, 0, -8);
tank_engine_0_3_0.eyeOffset = new Vec3(0, 3, 0);
tank_engine_0_3_0.animationSpeed = 0.9;
registerRailVehicle(tank_engine_0_3_0);

const goodsWagon = new VehicleDefinition();
goodsWagon.name = "simple_trains:goods_wagon";
goodsWagon.mesh = "goods_wagon.gltf";
goodsWagon.textures = ["goods_wagon.png"];
goodsWagon.collisionBox = new Vec3(1, 1.06, 1.61);
registerRailVehicle(goodsWagon);

const goodsVan = new VehicleDefinition();
goodsVan.name = "simple_trains:goods_van";
goodsVan.mesh = "goods_van.gltf";
goodsVan.textures = ["goods_van.png"];
goodsVan.collisionBox = new Vec3(1, 1.8, 1.61);
registerRailVehicle(goodsVan);

// void MapblockMeshGenerator::drawRaillikeNode()
// GX suggests to copy the way rails are drawn to make them work
