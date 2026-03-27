export class TrackIdentities {
	normal: number;

	constructor(normal: number) {
		this.normal = normal;
	}
}

export const trackIdentity: TrackIdentities = (() => {
	const gameID = core.get_game_info().id;

	if (gameID == "minetest") {
		return new TrackIdentities(core.get_content_id("carts:rail"));
	}

	throw new Error(
		`\nGame < ${gameID} > is not supported by simple_trains!\n` +
			"Please submit a PR with the rail type so that this game can be added.",
	);
})();
