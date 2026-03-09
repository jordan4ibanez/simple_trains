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

---Goes clockwise from 0.
---@enum direction
local DIRECTION = {
	null = 0,
	north = 1,
	east = 2,
	south = 3,
	west = 4,
}

---@class vec3
---@field public x number
---@field public y number
---@field public z number


---@class Train
local train = {}
train.object = nil

---@type vec3
train.position = vector.new(0, 0, 0)
---@type vec3
train.old_position = vector.new(0, 0, 0)
---@type vec3
train.forward_position = vector.new(0, 0, 0)

---@type boolean
train.on_track = false
---@type boolean
train.was_on_track = false
---@type train_state
train.state = STATE.idle
---@type number
train.idle_timer = 0
---@type direction
train.direction = DIRECTION.null

train.initial_properties = {
	visual = "mesh",
	mesh = "test_train.gltf",
	textures = { "test_train.png" },
	physical = false,
	collide_with_objects = false,
	selectionbox = {
		-0.2, -0.4, -0.2,
		0.2, 0.4, 0.2
	}
}

function train:on_activate(staticdata, dtime_s)
	-- self.object:set_acceleration(vector.new(0, -10, 0))
	-- self.object:set_velocity(vector.new(0, 0, 0))
end

-- function train:handle_physics()
-- 	if self.on_track ~= self.was_on_track then
-- 		self.object:set_properties({
-- 			physical = not self.on_track
-- 		})

-- 		local gravity = -10
-- 		if self.on_track then gravity = 0 end
-- 		self.object:set_acceleration(vector.new(0, gravity, 0))
-- 		self.object:set_velocity(vector.new(0, 0, 0))
-- 		-- This fixes a client side guessing bug.
-- 		self.object:set_pos(self.object:get_pos())
-- 	end
-- end

function train:update_position()
	self.old_position = vector.copy(self.position)
	self.position = vector.round(self.object:get_pos())
	-- self:handle_physics()

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
end

---Train on a single track searches for a
---@param dtime number
function train:search_idle(dtime)
	self.idle_timer = self.idle_timer + dtime
	if self.idle_timer > 0.25 then
		self.idle_timer = self.idle_timer - 0.25
		print("searching for direction")
	end
end

---Train sits there idle and waits for a track update.
---@param dtime number
function train:idle(dtime)
	if not self.on_track then
		-- Magnetize to the nearest track.
		self.idle_timer = self.idle_timer + dtime
		if self.idle_timer > 0.25 then
			self.idle_timer = self.idle_timer - 0.25

			local new_pos = core.find_node_near(self.object:get_pos(), 1, track)
			if new_pos then
				self.object:move_to(new_pos)
			end
		end
	elseif self.direction == DIRECTION.null then
		-- This allows you to change the locomotive initial direction.
		self:search_idle(dtime)
	end

	-- if not self.was_on_track and self.on_track then
	-- 	self.object:set_pos(self.position)
	-- end
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
