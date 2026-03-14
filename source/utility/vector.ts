import { ShallowVector2, ShallowVector3 } from "../../luanti-api";
import { randomRange } from "./math";

const rr = randomRange;

export class Vec3 implements ShallowVector3 {
	x: number = 0;
	y: number = 0;
	z: number = 0;

	constructor(x?: number, y?: number, z?: number) {
		this.x = x || 0;
		this.y = y || 0;
		this.z = z || 0;
	}

	static zero(): Vec3 {
		return new Vec3(0, 0, 0);
	}

	clone(): Vec3 {
		const output = new Vec3();
		output.x = this.x;
		output.y = this.y;
		output.z = this.z;
		return output;
	}

	set(x: number, y: number, z: number): Vec3 {
		this.x = x;
		this.y = y;
		this.z = z;
		return this;
	}

	add(other: ShallowVector3): Vec3 {
		this.x = this.x + other.x;
		this.y = this.y + other.y;
		this.z = this.z + other.z;
		return this;
	}

	addImmutable(other: ShallowVector3): Vec3 {
		const output = new Vec3();
		output.x = this.x + other.x;
		output.y = this.y + other.y;
		output.z = this.z + other.z;
		return output;
	}

	subtract(other: ShallowVector3): Vec3 {
		this.x = this.x - other.x;
		this.y = this.y - other.y;
		this.z = this.z - other.z;
		return this;
	}

	subtractImmutable(other: ShallowVector3): Vec3 {
		const output = new Vec3();
		output.x = this.x - other.x;
		output.y = this.y - other.y;
		output.z = this.z - other.z;
		return output;
	}

	divide(other: ShallowVector3): Vec3 {
		this.x = this.x / other.x;
		this.y = this.y / other.y;
		this.z = this.z / other.z;
		return this;
	}

	divideImmutable(other: ShallowVector3): Vec3 {
		const output = new Vec3();
		output.x = this.x / other.x;
		output.y = this.y / other.y;
		output.z = this.z / other.z;
		return output;
	}

	multiply(other: ShallowVector3): Vec3 {
		this.x = this.x * other.x;
		this.y = this.y * other.y;
		this.z = this.z * other.z;
		return this;
	}

	multiplyImmutable(other: ShallowVector3): Vec3 {
		const output = new Vec3();
		output.x = this.x * other.x;
		output.y = this.y * other.y;
		output.z = this.z * other.z;
		return output;
	}

	copyFrom(other: ShallowVector3): Vec3 {
		this.x = other.x;
		this.y = other.y;
		this.z = other.z;
		return this;
	}

	randomize(
		minX: number,
		maxX: number,
		minY: number,
		maxY: number,
		minZ: number,
		maxZ: number,
	): Vec3 {
		this.x = rr(minX, maxX);
		this.y = rr(minY, maxY);
		this.z = rr(minZ, maxZ);
		return this;
	}

	distance(other: Vec3): number {
		const x = this.x - other.x;
		const y = this.y - other.y;
		const z = this.z - other.z;
		return math.sqrt(x * x + y * y + z * z);
	}

	equals(other: Vec3): boolean {
		return this.x == other.x && this.y == other.y && this.z == other.z;
	}

	length(): number {
		return math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
	}

	normalize(): Vec3 {
		const len = this.length();
		if (len == 0) {
			this.set(0, 0, 0);
		} else {
			this.divide(new Vec3(len, len, len));
		}
		return this;
	}

	normalizeImmutable(): Vec3 {
		const len = this.length();
		if (len == 0) {
			return new Vec3(0, 0, 0);
		} else {
			return new Vec3().copyFrom(this).divide(new Vec3(len, len, len));
		}
	}

	/**
	 * Set the vector to a yaw.
	 * @param yaw The yaw in radians.
	 * @returns This.
	 */
	fromYaw(yaw: number): Vec3 {
		this.x = -math.sin(yaw);
		this.y = 0;
		this.z = math.cos(yaw);
		return this;
	}

	/**
	 * Get the yaw of the vector.
	 * @returns The yaw in radians.
	 */
	toYaw(): number {
		return -math.atan2(this.x, this.z);
	}

	/**
	 * Convert a direction vector into a rotation vector.
	 * @returns This as a rotation vector.
	 */
	toRotation(): Vec3 {
		const forward = this.normalizeImmutable();
		return this.set(
			math.asin(forward.y),
			-math.atan2(forward.x, forward.z),
			0,
		);
	}

	/**
	 * Create a new rotation vector from a direction vector.
	 * @returns A new rotation vector.
	 */
	toRotationImmutable(): Vec3 {
		const forward = this.normalizeImmutable();
		return new Vec3(
			math.asin(forward.y),
			-math.atan2(forward.x, forward.z),
			0,
		);
	}

	/**
	 * Convert a rotation vector into a direction vector.
	 * @returns This as a direction vector.
	 */
	toDirection(): Vec3 {
		const len = math.cos(this.x);
		return this.set(
			len * math.cos(this.y),
			math.sin(this.x),
			len * math.sin(-this.y),
		);
	}

	/**
	 * Create a new direction vector from a rotation vector.
	 * @returns A new direction vector.
	 */
	toDirectionImmutable(): Vec3 {
		const len = math.cos(this.x);
		return new Vec3(
			len * math.cos(this.y),
			math.sin(this.x),
			len * math.sin(-this.y),
		);
	}

	/**
	 * Linear interpolate a vector to another vector by an amount.
	 * @param other Other Vector.
	 * @param amount 0.0 - 1.0
	 * @returns This vector lerped to other vector by amount.
	 */
	lerp(other: Vec3, amount: number): Vec3 {
		return this.set(
			this.x * (1 - amount) + other.x * amount,
			this.y * (1 - amount) + other.y * amount,
			this.z * (1 - amount) + other.z * amount,
		);
	}

	toString(): string {
		return (
			"(" +
			tostring(this.x) +
			"," +
			tostring(this.y) +
			"," +
			tostring(this.z) +
			")"
		);
	}
}

export class Vec2 implements ShallowVector2 {
	x: number = 0;
	y: number = 0;

	constructor(x?: number, y?: number) {
		this.x = x || 0;
		this.y = y || 0;
	}

	static zero(): Vec2 {
		return new Vec2(0, 0);
	}

	clone(): Vec2 {
		const output = new Vec2();
		output.x = this.x;
		output.y = this.y;
		return output;
	}

	set(x: number, y: number): Vec2 {
		this.x = x;
		this.y = y;
		return this;
	}

	add(other: ShallowVector2): Vec2 {
		this.x = this.x + other.x;
		this.y = this.y + other.y;
		return this;
	}

	addImmutable(other: ShallowVector2): Vec2 {
		const output = new Vec2();
		output.x = this.x + other.x;
		output.y = this.y + other.y;
		return output;
	}

	subtract(other: ShallowVector2): Vec2 {
		this.x = this.x - other.x;
		this.y = this.y - other.y;
		return this;
	}

	subtractImmutable(other: ShallowVector2): Vec2 {
		const output = new Vec2();
		output.x = this.x - other.x;
		output.y = this.y - other.y;
		return output;
	}

	divide(other: ShallowVector2): Vec2 {
		this.x = this.x / other.x;
		this.y = this.y / other.y;
		return this;
	}

	divideImmutable(other: ShallowVector2): Vec2 {
		const output = new Vec2();
		output.x = this.x / other.x;
		output.y = this.y / other.y;
		return output;
	}

	multiply(other: ShallowVector2): Vec2 {
		this.x = this.x * other.x;
		this.y = this.y * other.y;
		return this;
	}

	multiplyImmutable(other: ShallowVector2): Vec2 {
		const output = new Vec2();
		output.x = this.x * other.x;
		output.y = this.y * other.y;
		return output;
	}

	copyFrom(other: ShallowVector2): Vec2 {
		this.x = other.x;
		this.y = other.y;
		return this;
	}

	randomize(minX: number, maxX: number, minY: number, maxY: number): Vec2 {
		this.x = rr(minX, maxX);
		this.y = rr(minY, maxY);

		return this;
	}

	distance(other: ShallowVector2): number {
		const x = this.x - other.x;
		const y = this.y - other.y;
		return math.sqrt(x * x + y * y);
	}

	equals(other: ShallowVector2): boolean {
		return this.x == other.x && this.y == other.y;
	}

	toString(): string {
		return "(" + tostring(this.x) + "," + tostring(this.y) + ")";
	}
}
