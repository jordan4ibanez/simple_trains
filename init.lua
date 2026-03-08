local modpath = core.get_modpath(core.get_current_modname())
local track = dofile(modpath .. "/track.lua")
if track == "unsupported" then
	return
end


---@enum train_state
local STATE = {
	idle = 0,
	rolling = 1
}


---@class Train
local train = {}
train.object = nil

train.position = vector.new(0, 0, 0)
train.old_position = vector.new(0, 0, 0)
---@type boolean
train.on_track = false
---@type train_state
train.state = STATE.idle
---@type number
train.idle_timer = 0

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

---Train sits there idle and waits for a track update.
function train:idle()
	print("idling")
end

function train:on_step(dtime, moveresult)
	self:detect_on_track()
	if self.state == STATE.idle then
		self:idle()
	elseif self.state == STATE.rolling then
	end
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
