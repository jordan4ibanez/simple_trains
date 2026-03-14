import { track } from "./game_detection";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual } from "./utility/enums";
import { degToRad } from "./utility/math";
import { Vec3 } from "./utility/vector";

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
	null = 0,
	north = 1,
	east = 2,
	south = 3,
	west = 4,
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
const turn_skip_dir = {
	[DIRECTION.north]: DIRECTION.south,
	[DIRECTION.south]: DIRECTION.north,

	[DIRECTION.east]: DIRECTION.west,
	[DIRECTION.west]: DIRECTION.east,
};

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	oldPosition: Vec3 = new Vec3();
	forwardPosition: Vec3 = new Vec3();

	onTrack: boolean = false;
	wasOnTrack: boolean = false;
	state: STATE = STATE.idle;

	idleTimer: number = 0;
	direction: DIRECTION = DIRECTION.null;
	rollingTimer: number = 0;
	movementLerp: number = 0;

	speed: number = 0;

	initial_properties: ObjectProperties = {
		visual: EntityVisual.mesh,
		mesh: "test_train.gltf",
		textures: ["test_train.png"],
		physical: false,
		collide_with_objects: false,
		selectionbox: [-0.2, -0.4, -0.2, 0.2, 0.4, 0.2],
	};

	on_activate(staticData: string, delta: number): void {
		this.object.set_armor_groups({ punch_operable: 1 });
	}

	on_rightclick(clicker: ObjectRef): void {
		this.reverseDirection();
	}

	on_punch(
		puncher: ObjectRef | null,
		timeFromLastPunch: number | null,
		toolCapabilities: ToolCapabilities | null,
		dir: Vec3 | null,
		damage: number,
	): void {
		switch (this.state) {
			case STATE.idle: {
				this.state = STATE.rolling;
			}
			case STATE.rolling: {
				this.state = STATE.idle;
			}
			case STATE.halted: {
				this.state = STATE.rolling;
			}
		}
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
		switch (this.state) {
			case STATE.idle: {
				this.idleUpdatePosition();
				this.idleDetectOnTrack();
				this.idle(delta);
			}
			case STATE.rolling: {
				this.roll(delta);
			}
			case STATE.halted: {
				// Does nothing.
			}
		}
	}

	/**
	 * Set the locomotive's rotation.
	 */
	setRotation(): void {
		if (this.direction == DIRECTION.null) {
			this.object.set_yaw((DIRECTION.north * -90 + 90) * degToRad);
		} else {
			this.object.set_yaw((this.direction * -90 + 90) * degToRad);
		}
	}

	roll(delta: number): void {
		
	}

	//? ******************
	//? * IDLING METHODS *
	//? ******************

	/**
	 * Locomotive idle behavior.
	 * Sits there and waits for a track update to be able to move to.
	 * @param delta Time between server ticks.
	 */
	idle(delta: number): void {
		this.idleTimer += delta;
		if (this.idleTimer < 0.2) {
			return;
		}
		this.idleTimer -= 0.2;

		if (!this.onTrack) {
			// Magnetize to the nearest track.
			const newPos = core.find_node_near(this.object.get_pos(), 1, track);
			if (newPos != null) {
				this.object.move_to(newPos);
			}
		} else if (this.direction == DIRECTION.null) {
			// Allows you to change the locomotive initial direction.
			this.idleSearch();
		} else {
			// This also makes sure the locomotive can move at least 1 node forward.
			// Also allows you to change the initial direction.
			this.idleCheckForward();
		}
	}

	/**
	 * Check if the forward node is still a track when idling.
	 */
	idleCheckForward(): void {
		const [id] = core.get_node_raw(
			this.forwardPosition.x,
			this.forwardPosition.y,
			this.forwardPosition.z,
		);

		// Track still exists.
		if (id == trackID) {
			return;
		}

		// Locomotive gets reset to initial properties.
		this.forwardPosition.set(0, 0, 0);
		this.direction = DIRECTION.null;
		this.setRotation();
	}

	/**
	 * Locomotive searches around itself for a node it can face towards when idling.
	 */
	idleSearch(): void {
		const temp = new Vec3();
		let index = 0;
		for (const dir of dirs) {
			temp.setVec(this.position).add(dir);

			const [id] = core.get_node_raw(temp.x, temp.y, temp.z);

			if (id == trackID) {
				this.direction = reverseLookupEnum[index];
				this.setRotation();
				this.forwardPosition.setVec(temp);
				break;
			}
			index++;
		}
	}

	/**
	 * Locomotive detects if it is on a track when idling.
	 */
	idleDetectOnTrack(): void {
		this.wasOnTrack = this.onTrack;

		const [id] = core.get_node_raw(
			this.position.x,
			this.position.y,
			this.position.z,
		);

		this.onTrack = id == trackID;
		if (!this.onTrack) {
			this.direction = DIRECTION.null;
		}
	}

	/**
	 * Locomotive gets it's rounded node positioning when idle.
	 */
	idleUpdatePosition(): void {
		this.oldPosition.setVec(this.position);
		this.position.setVec(this.object.get_pos()).round();

		core.add_particle({
			pos: this.position,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_stone.png",
		});

		core.add_particle({
			pos: this.forwardPosition,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_dirt.png",
		});
	}

	/**
	 * Attempt to turn the locomotive around when idling.
	 */
	reverseDirection(): void {
		if (this.state != STATE.idle) {
			return;
		}

		const temp = new Vec3();

		for (const i of $range(0, 3)) {
			const o = (i + this.direction + 1) % 4;

			temp.setVec(this.position).add(dirs[o]);

			const [id] = core.get_node_raw(temp.x, temp.y, temp.z);

			if (id == trackID) {
				this.direction = reverseLookupEnum[o];
				this.setRotation();
				this.forwardPosition.setVec(temp);
				break;
			}
		}
	}
}

registerEntity("simple_trains:train", TestTrain);
