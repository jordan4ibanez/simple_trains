local modpath = core.get_modpath(core.get_current_modname())
local track = dofile(modpath .. "/track.lua")
if track == "unsupported" then
	return
end

---@class Train
local train = {}
train.object = nil

train.position = vector.new(0, 0, 0)

train.initial_properties = {
	visual = "cube",
	physical = true,
}

---@return boolean
function train:on_track()
	

	return false
end

function train:on_activate(staticdata, dtime_s)
	-- self.object:set_acceleration(vector.new(0,-10,0))
	self.object:set_velocity(vector.new(0, 0, 0))


	self.position = vector.round(self.object:get_pos())
end

function train:on_step(dtime, moveresult)

end

core.register_entity("simple_trains:train", train)
