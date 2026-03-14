export const track: string = (() => {
	const gameID = core.get_game_info().id;

	if (gameID == "minetest") {
		return "carts:rail";
	}

	throw new Error(`\nGame < ${gameID} > is not supported by simple_trains!\n` +
		"Please submit a PR with the rail type so that this game can be added."
	);
})();
