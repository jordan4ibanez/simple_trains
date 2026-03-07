---@class Train
local train = {}
train.object = nil

train.initial_properties = {
	visual = "cube",
	physical = true,
}

function train:on_activate(staticdata, dtime_s)
	-- self.object:set_acceleration(vector.new(0,-10,0))
	self.object:set_velocity(vector.new(0,0,0))
end

function train:test()
	print("choo choo")
end

function train:on_step(dtime, moveresult)
	print(dtime)
	self:test()
end

core.register_entity("simple_trains:train", train)