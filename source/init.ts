import { track } from "./game_detection";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual } from "./utility/enums";
import { Vec3 } from "./utility/vector";

const trackID: number = core.get_content_id(track);

enum State {
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

const reverse_lookup_enum = [
	DIRECTION.north,
	DIRECTION.east,
	DIRECTION.south,
	DIRECTION.west,
];

/// This is set up so the train doesn't turn backwards.
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
	state: State = State.idle;

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
			case State.idle: {
				this.state = State.rolling;
			}
			case State.rolling: {
				this.state = State.idle;
			}
			case State.halted: {
				this.state = State.rolling;
			}
		}
	}

	on_step(delta: number, moveResult: MoveResult | null): void {
		switch (this.state) {
			case State.idle: {
				this.updatePosition();
				this.detectOnTrack();
				// this.idleTimer(delta); // todo
			}
			case State.rolling: {
				// this.roll(delta); // todo
			}
			case State.halted: {
				// Does nothing.
			}
		}
	}

	detectOnTrack(): void {
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

	updatePosition(): void {
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

	reverseDirection(): void {
		if (this.state == State.idle) {
			return;
		}

		for (const i of $range(1, 4)) {
			print("implement reverseDirection");
		}
	}
}

registerEntity("simple_trains:train", TestTrain);
