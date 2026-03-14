import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual } from "./utility/enums";
import { Vec3 } from "./utility/vector";

enum State {
	idle = 0,
	rolling = 1,
	halted = 2,
}
enum Direction {
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
	Direction.north,
	Direction.east,
	Direction.south,
	Direction.west,
];

/// This is set up so the train doesn't turn backwards.
const turn_skip_dir = {
	[Direction.north]: Direction.south,
	[Direction.south]: Direction.north,

	[Direction.east]: Direction.west,
	[Direction.west]: Direction.east,
};

class TestTrain extends Entity {
	position: Vec3 = new Vec3();
	oldPosition: Vec3 = new Vec3();
	forwardPosition: Vec3 = new Vec3();

	onTrack: boolean = false;
	wasOnTrack: boolean = false;
	state: State = State.idle;

	idleTimer: number = 0;
	direction: Direction = Direction.null;
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
				// this.detectOnTrack(); // todo
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
