local modpath = core.get_modpath(core.get_current_modname())
local track = dofile(modpath .. "/track.lua")
if track == "unsupported" then
	return
end

---@class Train
local train = {}
train.object = nil

train.position = vector.new(0, 0, 0)
train.old_position = vector.new(0, 0, 0)
train.on_track = false

train.initial_properties = {
	visual = "mesh",
	mesh = "test_train.gltf",
	textures = { "test_train.png" },
	physical = true,
	collisionbox = {
		0, 0, 0,
		1, 1, 1,
	}
}

function train:detect_on_track()
	self.on_track = core.get_node(self.position).name == track
end

function train:on_activate(staticdata, dtime_s)
	-- self.object:set_acceleration(vector.new(0,-10,0))
	self.object:set_velocity(vector.new(0, 0, 0))
	self.object:set_acceleration(vector.new(0, -10, 0))


	self.position = vector.round(self.object:get_pos())
	self.old_position = vector.copy(self.position)

	print(dump(self.object:get_properties().collisionbox))
end

function train:on_step(dtime, moveresult)
	self:detect_on_track()
end

core.register_entity("simple_trains:train", train)


core.register_chatcommand("t", {
	func = function(name)
		local p = core.get_player_by_name(name)
		if not p then return end
		local pos = p:get_pos()
		pos.y = pos.y + 1
		core.add_entity(pos, "simple_trains:train")
	end
})
