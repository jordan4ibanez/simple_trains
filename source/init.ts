import { ShallowVector3 } from "../luanti-api";
import { track } from "./game_detection";
import { trackRegistration, trackStraightID, trackTurnID } from "./track";
import { Entity, registerEntity } from "./utility/entity";
import { EntityVisual } from "./utility/enums";
import { degToRad } from "./utility/math";
import { Vec3 } from "./utility/vector";

trackRegistration();

core.register_chatcommand("t", {
	func: (name: string) => {
		const player = core.get_player_by_name(name);
		if (player == null) {
			return;
		}
		const pos = new Vec3()
			.setVec(player.get_pos())
			.add(new Vec3(0, 0.5, 0))
			.round();

		const [id] = core.get_node_raw(pos.x, pos.y, pos.z);

		if (id == trackStraightID) {
			core.add_entity(pos, "simple_trains:train");
		}
	},
});

const temp = new Vec3();

class TestTrain extends Entity {
	initial_properties: ObjectProperties = {
		visual: EntityVisual.mesh,
		mesh: "test_train.gltf",
		textures: ["test_train.png"],
		physical: true,
		collide_with_objects: false,
		selectionbox: [-0.2, -0.4, -0.2, 0.2, 0.4, 0.2],
		automatic_face_movement_dir: 0,
	};

	driver: ObjectRef | null = null;

	on_activate(staticData: string, delta: number): void {
		this.object.set_armor_groups({ punch_activated: 1 });
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

		this.driver = clicker;
		clicker.set_attach(
			this.object,
			"",
			new Vec3(0, 0, 0),
			new Vec3(0, 0, 0),
		);
	}
}

registerEntity("simple_trains:train", TestTrain);
