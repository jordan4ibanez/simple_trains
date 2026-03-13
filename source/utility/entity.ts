import { ShallowVector3 } from "../../luanti-api";
import { LogLevel } from "./enums";
import { Vec2, Vec3 } from "./vector";

/** Typescript Luaentity. */
export abstract class Entity implements LuaEntity {
	name: string = "";
	object: ObjectRef = {} as ObjectRef;

	// Abstract members.
	initial_properties?: ObjectProperties;
	on_activate?(staticData: string, delta: number): void;
	on_deactivate?(removal: boolean): void;
	// Note: moveResult: only available if physical=true
	on_step?(delta: number, moveResult: MoveResult | null): void;
	on_punch?(
		puncher: ObjectRef | null,
		timeFromLastPunch: number | null,
		toolCapabilities: ToolCapabilities | null,
		dir: Vec3 | null,
		damage: number,
	): void;
	on_death?(killer: ObjectRef): void;
	on_rightclick?(clicker: ObjectRef): void;
	on_attach_child?(child: ObjectRef): void;
	on_detach_child?(child: ObjectRef): void;
	on_detach?(parent: ObjectRef): void;
	get_staticdata?(): string;
}

// French jump scare.
type leClassType = { new (): LuaEntity };

/**
 * A bolt on to allow you to directly register MT lua entities as TS classes.
 * @param clazz Class definition.
 */
export function registerEntity(name: string, clazz: leClassType) {
	const instance = new clazz();
	core.register_entity(":" + string, instance);
}

/**
 * I don't feel like dealing with unsound string typos. So this fixes that.
 * @param pos Position in world.
 * @param clazz LuaEntity descendant.
 * @param initFunction A decorator function for when (and if) the entity spawns.
 */
export function spawnEntity(
	pos: ShallowVector3,
	clazz: leClassType,
	initFunction?: (obj: ObjectRef) => void,
): ObjectRef | null {
	const ent = core.add_entity(pos, clazz.name);
	if (ent == null || !ent.is_valid()) {
		core.log(
			LogLevel.error,
			`Failed to spawn entity at: ${pos.toString()}`,
		);
		return null;
	}
	if (initFunction) {
		initFunction(ent);
	}
	return ent;
}
