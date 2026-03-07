local game_id = core.get_game_info().id

if game_id == "minetest" then
	return "carts:rail"
end

return "unsupported"
