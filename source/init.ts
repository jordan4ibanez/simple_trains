import { track } from "./game_detection";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual } from "./utility/enums";
import { degToRad } from "./utility/math";
import { Vec3 } from "./utility/vector";

core.register_chatcommand("t", {
	func: (name: string) => {
		const player = core.get_player_by_name(name);
		if (player == null) {
			return;
		}
		const pos = player.get_pos();
		pos.y += 0.5;
		core.add_entity(pos, "simple_trains:train");
	},
});

/**
 * A game agnostic way to have rails function faster.
 */
const trackID: number = core.get_content_id(track);

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

const dirs = [
	new Vec3(0, 0, 1), //  North.
	new Vec3(1, 0, 0), //  East.
	new Vec3(0, 0, -1), // South.
	new Vec3(-1, 0, 0), // West.
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
const turn_skip_dir: Dictionary<DIRECTION, DIRECTION> = {
	[DIRECTION.north]: DIRECTION.south, // 0 - 2
	[DIRECTION.east]: DIRECTION.west, //   1 - 3
	[DIRECTION.south]: DIRECTION.north, // 2 - 0
	[DIRECTION.west]: DIRECTION.east, //   3 - 1
};

/**
 * Check if a position is track.
 * @param pos A position.
 * @returns If it is track.
 */
function isTrack(pos: Vec3): boolean {
	const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
	return id == trackID;
}

/**
 * A temporary vector reserved to reduce GC footprint.
 */
const temp: Vec3 = new Vec3();

class TestTrain extends Entity {
	position: Vec3 = new Vec3();

	forwardPosition: Vec3 = new Vec3();
	forwardValid: boolean = false;

	backwardPosition: Vec3 = new Vec3();
	backwardValid: boolean = false;

	onTrack: boolean = false;
	wasOnTrack: boolean = false;
	state: STATE = STATE.idle;

	idleTimer: number = 0;
	direction: DIRECTION = DIRECTION.null;
	rollingTimer: number = 0;

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

	on_step(delta: number, moveResult: MoveResult | null): void {
		if (this.state == STATE.idle) {
			// Do not want locomotives hogging the cpu.
			this.idleTimer += delta;
			if (this.idleTimer < 0.3) {
				return;
			}
			this.idleTimer -= 0.3;

			this.detectOnTrack();

			if (this.onTrack && !this.wasOnTrack) {
				this.magnetizeTrack();
			}

			if (this.onTrack) {
				this.detectForward();
				this.detectBackward();
			}
		} else if (this.state == STATE.rolling) {
			this.debugRolling(delta);
		}
	}

	on_activate(staticData: string, delta: number): void {
		this.object.set_armor_groups({
			punch_operable: 1,
		});
	}

	on_punch(
		puncher: ObjectRef | null,
		timeFromLastPunch: number | null,
		toolCapabilities: ToolCapabilities | null,
		dir: Vec3 | null,
		damage: number,
	): void {
		if (this.state == STATE.idle) {
			this.state = STATE.rolling;
		} else {
			this.state = STATE.idle;
		}
	}

	debugRolling(delta: number): void {
		//! This was debug.
		// if (this.up) {
		// 	this.movementLerp += delta;
		// 	if (this.movementLerp >= 1) {
		// 		this.movementLerp = 1;
		// 		this.up = false;
		// 	}
		// } else {
		// 	this.movementLerp -= delta;
		// 	if (this.movementLerp <= -1) {
		// 		this.movementLerp = -1;
		// 		this.up = true;
		// 	}
		// }

		this.movementLerp += delta;

		if (this.movementLerp >= 1.0) {
			this.movementLerp = 1.0;
		}

		if (this.movementLerp == 0) {
			this.object.move_to(this.position);
		} else if (this.movementLerp > 0) {
			if (this.forwardValid) {
				this.object.move_to(
					this.vecMovement
						.setVec(this.position)
						.lerp(this.forwardPosition, this.movementLerp),
				);
			}
		} else if (this.movementLerp < 0) {
			if (this.backwardValid) {
				this.object.move_to(
					this.vecMovement
						.setVec(this.position)
						.lerp(
							this.backwardPosition,
							math.abs(this.movementLerp),
						),
				);
			}
		}

		this.debugPositionsVisual();
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

	/**
	 * Snaps the locomotive to it's current track.
	 */
	magnetizeTrack(): void {
		if (isTrack(this.position)) {
			this.object.move_to(this.position);
		}
	}

	/**
	 * Detect the forward position. (Priority)
	 */
	detectForward(): void {
		// Do not overlap positions.
		if (
			!isTrack(this.forwardPosition) ||
			this.forwardPosition.equals(this.position)
		) {
			this.forwardValid = false;
		} else {
			this.forwardValid = true;
			return;
		}

		let index = 0;
		for (const dir of dirs) {
			temp.setVec(this.position).add(dir);

			// Don't try to steer into itself.
			if (this.backwardValid && temp.equals(this.backwardPosition)) {
				continue;
			}

			if (isTrack(temp)) {
				this.direction = reverseLookupEnum[index];
				this.setRotation();
				this.forwardPosition.setVec(temp);
				this.forwardValid = true;
				break;
			}
			index++;
		}
	}

	/**
	 * Detect the backward position. (Forward takes priority)
	 */
	detectBackward(): void {
		// Do not overlap positions. Forward takes priority.
		if (
			!isTrack(this.backwardPosition) ||
			this.backwardPosition.equals(this.forwardPosition) ||
			this.backwardPosition.equals(this.position)
		) {
			this.backwardValid = false;
		} else {
			this.backwardValid = true;
			return;
		}

		let index = 0;
		for (const dir of dirs) {
			temp.setVec(this.position).add(dir);

			// Don't try to steer into itself.
			if (this.forwardValid && temp.equals(this.forwardPosition)) {
				continue;
			}

			if (isTrack(temp)) {
				this.backwardPosition.setVec(temp);
				this.backwardValid = true;
				break;
			}
			index++;
		}
	}

	debugPositionsVisual(): void {
		if (this.onTrack) {
			core.add_particle({
				pos: this.position,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_stone.png",
			});
		}
		if (this.forwardValid) {
			core.add_particle({
				pos: this.forwardPosition,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_wood.png",
			});
		}
		if (this.backwardValid) {
			core.add_particle({
				pos: this.backwardPosition,
				velocity: new Vec3(0, 2, 0),
				size: 1,
				texture: "default_dirt.png",
			});
		}
	}

	/**
	 * Detect if the current position of the locomotive is track.
	 */
	detectOnTrack(): void {
		this.wasOnTrack = this.onTrack;
		this.onTrack = isTrack(
			this.position.setVec(this.object.get_pos()).round(),
		);

		if (!this.onTrack) {
			this.forwardValid = false;
			this.backwardValid = false;
		}

		this.debugPositionsVisual();
	}
}

registerEntity("simple_trains:train", TestTrain);
