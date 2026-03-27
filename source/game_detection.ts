export class TrackIdentities {
	normal: number;
	// booster
	// brake

	constructor(normal: number) {
		this.normal = normal;
	}
}

export const __trackIdentity: TrackIdentities = (() => {
	const gameID = core.get_game_info().id;

	if (gameID == "minetest") {
		return new TrackIdentities(core.get_content_id("carts:rail"));
	}

	throw new Error(
		`\nGame < ${gameID} > is not supported by simple_trains!\n` +
			"Please submit a PR with the rail type so that this game can be added.",
	);
})();

export const __playerAnimationFunction: (
	p: ObjectRef,
	animation: string,
) => void = (() => {
	const gameID = core.get_game_info().id;

	if (gameID == "minetest") {
		return (player: ObjectRef, animation: string) => {
			const [attach] = player.get_attach();
			(globalThis as any).player_api.player_attached[
				player.get_player_name()
			] = attach != null;

			(globalThis as any).player_api.set_animation(player, animation);
		};
	}

	throw new Error(
		`\nGame < ${gameID} > is not supported by simple_trains!\n` +
			"Please submit a PR with the player attachment function so that this game can be added.",
	);
})();
