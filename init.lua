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
---@type boolean
train.was_on_track = false
---@type train_state
train.state = STATE.idle
---@type number
train.idle_timer = 0

train.initial_properties = {
	visual = "mesh",
	mesh = "test_train.gltf",
	textures = { "test_train.png" },
	physical = true,
	collide_with_objects = false,
}

function train:on_activate(staticdata, dtime_s)
	-- self.object:set_acceleration(vector.new(0,-10,0))
	self.object:set_velocity(vector.new(0, 0, 0))
	self.object:set_acceleration(vector.new(0, -10, 0))
end

function train:update_position()
	self.position = vector.round(self.object:get_pos())
	self.old_position = vector.copy(self.position)

	core.add_particle({
		pos = self.position,
		velocity = { x = 0, y = 2, z = 0 },
		size = 1,
		texture = "default_stone.png"
	})
end

function train:detect_on_track()
	self.was_on_track = self.on_track
	self.on_track = core.get_node(self.position).name == track
	self.object:set_properties({
		physical = self.on_track
	})
end

---Train sits there idle and waits for a track update.
---@param dtime number
function train:idle(dtime)
	print("idling")
end

---Train on server step.
---@param dtime number
---@param moveresult table
function train:on_step(dtime, moveresult)
	self:update_position()
	self:detect_on_track()

	if self.state == STATE.idle then
		self:idle(dtime)
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
