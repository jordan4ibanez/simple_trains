import { Entity, registerEntity } from "./utility/entity";

class TestTrain extends Entity {
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
