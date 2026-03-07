local train = {}

function train:test()
	print("choo choo")
end

function train:on_step(dtime, moveresult)
	print(dtime)
	self:test()
end

core.register_entity("simple_trains:train", train)