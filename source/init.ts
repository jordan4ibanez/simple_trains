import { Entity, registerEntity } from "./utility/entity";
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

	on_step(delta: number, moveResult: MoveResult | null): void {
		for (const ent of core.get_objects_inside_radius(
			this.object.get_pos(),
			2,
		)) {
			if (ent.is_player()) {
				continue;
			}

			const luaEnt = ent.get_luaentity();
			if (luaEnt == null) {
				continue;
			}

			print(luaEnt.name);
		}
	}
}

registerEntity("simple_trains:train", TestTrain);
