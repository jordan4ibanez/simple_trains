-- It was a lie, this isn't simple at all.
local modpath = core.get_modpath(core.get_current_modname())

---@type string
local track = dofile(modpath .. "/track.lua")
if track == "unsupported" then
	return
end

local debug_timer = 0.1

---@type number
local track_id = core.get_content_id(track)

---@type number
local DEG_TO_RAD = math.pi / 180

---@enum train_state
local STATE = {
	idle = 0,
	rolling = 1,
	halted = 2,
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


---@type vec3[]
local dirs = {
	vector.new(0, 0, 1), --  North.
	vector.new(1, 0, 0), --  East.
	vector.new(0, 0, -1), -- South.
	vector.new(-1, 0, 0), -- West.
}

local reverse_lookup_enum = {
	DIRECTION.north,
	DIRECTION.east,
	DIRECTION.south,
	DIRECTION.west
}

--- This is set up so the train doesn't turn backwards.
local turn_skip_dir = {
	[DIRECTION.north] = DIRECTION.south,
	[DIRECTION.south] = DIRECTION.north,

	[DIRECTION.east] = DIRECTION.west,
	[DIRECTION.west] = DIRECTION.east,
}

---Holds result of fast_output.
---@type vec3
local output = vector.new()

---auto dump calc into output vec3.
---@param pos vec3
---@param dir vec3
---@param out vec3
local function fast_output(pos, dir, out)
	out.x = pos.x + dir.x
	out.y = pos.y + dir.y
	out.z = pos.z + dir.z
end


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
---@type number
train.rolling_timer = 0

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
	self.object:set_armor_groups { punch_operable = 1 }
	-- self.object:set_acceleration(vector.new(0, -10, 0))
	-- self.object:set_velocity(vector.new(0, 0, 0))
end

function train:on_rightclick(clicker)
	self:reverse_direction()
end

function train:on_punch(puncher, time_from_last_punch, tool_capabilities, dir, damage)
	if self.state == STATE.idle then
		self.state = STATE.rolling
	elseif self.state == STATE.rolling then
		self.state = STATE.idle
	elseif self.state == STATE.halted then
		self.state = STATE.rolling
	end
end

---Attempt to turn the train around.
function train:reverse_direction()
	-- Trying to turn the train around while moving would be very complex.
	if self.state ~= STATE.idle then return end

	---@type number
	local o = 0

	for i = 1, 4 do
		o = ((i + self.direction) % 4) + 1

		if o ~= self.direction then
			fast_output(self.position, dirs[o], output)

			---@type number
			local id = core.get_node_raw(output.x, output.y, output.z)

			if id == track_id then
				self.direction = reverse_lookup_enum[o]
				self:set_rotation()
				self.forward_position = vector.copy(output)
				break
			end
		end
	end
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

---Set the locomotive's rotation.
function train:set_rotation()
	if self.direction == DIRECTION.null then
		self.object:set_yaw(((DIRECTION.north * -90) + 90) * DEG_TO_RAD)
	else
		self.object:set_yaw(((self.direction * -90) + 90) * DEG_TO_RAD)
	end
end

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

	core.add_particle({
		pos = self.forward_position,
		velocity = { x = 0, y = 2, z = 0 },
		size = 1,
		texture = "default_dirt.png"
	})
end

function train:detect_on_track()
	self.was_on_track = self.on_track
	---@type number
	local id = core.get_node_raw(self.position.x, self.position.y, self.position.z)
	self.on_track = id == track_id
	if not self.on_track then
		self.direction = DIRECTION.null
	end
end

---Ensure the forward position still exists.
function train:check_forward()
	---@type number
	local id = core.get_node_raw(self.forward_position.x, self.forward_position.y, self.forward_position.z)

	-- Track still exists.
	if id == track_id then return end

	-- Locomotive gets reset to initial properties.
	self.forward_position = vector.new(0, 0, 0)
	self.direction = DIRECTION.null
	self:set_rotation()
end

--- Train on a single track searches for track.
function train:search_idle()
	for index, dir in ipairs(dirs) do
		fast_output(self.position, dir, output)

		---@type number
		local id = core.get_node_raw(output.x, output.y, output.z)

		if id == track_id then
			self.direction = reverse_lookup_enum[index]
			self:set_rotation()
			self.forward_position = vector.copy(output)
			break
		end
	end
end

---Train sits there idle and waits for a track update.
---@param dtime number
function train:idle(dtime)
	self.idle_timer = self.idle_timer + dtime

	if self.idle_timer < debug_timer then return end
	self.idle_timer = self.idle_timer - debug_timer

	if not self.on_track then
		-- Magnetize to the nearest track.
		local new_pos = core.find_node_near(self.object:get_pos(), 1, track)
		if new_pos then
			self.object:move_to(new_pos)
		end
	elseif self.direction == DIRECTION.null then
		-- This allows you to change the locomotive initial direction.
		self:search_idle()
	else
		-- This makes sure the locomotive can move at least 1 node forward.
		-- Also allows you to change the initial direction.
		self:check_forward()
	end
end

---Attempts to turn the locomotive.
---Returns success.
---@return boolean
function train:turn()
	local avoid = turn_skip_dir[self.direction]
	for index, dir in ipairs(dirs) do
		if index ~= avoid then
			fast_output(self.position, dir, output)

			---@type number
			local id = core.get_node_raw(output.x, output.y, output.z)

			if id == track_id then
				self.direction = reverse_lookup_enum[index]
				self:set_rotation()
				self.forward_position = vector.copy(output)
				return true
			end
		end
	end
	return false
end

---Train tries to roll forward.
---Then attempts to turn.
---Stops if no track available.
---@param dtime number
function train:roll(dtime)
	self.rolling_timer = self.rolling_timer + dtime
	if self.rolling_timer < debug_timer then return end
	self.rolling_timer = self.rolling_timer - debug_timer

	---@type number
	local id = core.get_node_raw(self.forward_position.x, self.forward_position.y, self.forward_position.z)
	if id == track_id then
		self.object:move_to(self.forward_position)
		fast_output(self.position, dirs[self.direction], output)
		self.forward_position = vector.copy(output)

		-- Turn check.
		id = core.get_node_raw(self.forward_position.x, self.forward_position.y, self.forward_position.z)

		if id ~= track_id then
			print("trying to turn")
			local turn_success = self:turn()
			if turn_success then
				fast_output(self.position, dirs[self.direction], output)
				self.forward_position = vector.copy(output)
			end
		end
	else
		print("idle please")
	end
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
		self:roll(dtime)
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
