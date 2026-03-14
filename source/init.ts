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

function isTrack(pos: Vec3): boolean {
	const [id] = core.get_node_raw(pos.x, pos.y, pos.z);
	return id == trackID;
}

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
	movementLerp: number = 0;
	movementVec: Vec3 = new Vec3();

	speed: number = 0;

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
		}
	}

	magnetizeTrack(): void {
		const [id] = core.get_node_raw(
			this.position.x,
			this.position.y,
			this.position.z,
		);

		if (id == trackID) {
			this.object.move_to(this.position);
		}
	}

	detectOnTrack(): void {
		this.wasOnTrack = this.onTrack;
		this.onTrack = isTrack(
			this.position.setVec(this.object.get_pos()).round(),
		);

		core.add_particle({
			pos: this.position,
			velocity: new Vec3(0, 2, 0),
			size: 1,
			texture: "default_stone.png",
		});
	}
}

registerEntity("simple_trains:train", TestTrain);
