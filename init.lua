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
	visual = "cube",
	physical = true,
}

function train:detect_on_track()
	self.on_track = core.get_node(self.position).name == track
end

function train:on_activate(staticdata, dtime_s)
	-- self.object:set_acceleration(vector.new(0,-10,0))
	self.object:set_velocity(vector.new(0, 0, 0))


	self.position = vector.round(self.object:get_pos())
	self.old_position = vector.copy(self.position)
end

function train:on_step(dtime, moveresult)
	self:detect_on_track()
end

core.register_entity("simple_trains:train", train)
