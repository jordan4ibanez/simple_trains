local game_id = core.get_game_info().id

if game_id == "minetest" then
	return "carts:rail"
end

core.log("error", "simple_trains is unsupported in " .. game_id .. ". Make a PR.")

return "unsupported"
