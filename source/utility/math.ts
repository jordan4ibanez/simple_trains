const floor = math.floor;
const PI = math.pi;
const PI_HALF = math.pi / 2;
const PI2 = math.pi * 2;
const random = math.random;
const sqrt = math.sqrt;
const asin = math.asin;

export const doublePi = math.pi * 2;
export const halfPi = math.pi / 2;

export function randomRange(min: number, max: number): number {
	return random() * (max - min) + min;
}

/**
 * Clamp a number between two number. (inclusive)
 * @param min Min value.
 * @param max Max value.
 * @param input Value to be clamped.
 * @returns Clamped value.
 */
export function clamp(min: number, max: number, input: number): number {
	if (input < min) {
		return min;
	} else if (input > max) {
		return max;
	}
	return input;
}

/**
 * Truncate (cast float to int) a floating point value.
 * @param floating A floating point value.
 * @returns A truncated (casted to int) value. As close as you can get in lua.
 */
export function truncate(floating: number): number {
	return math.floor(floating * 10) / 10;
}

export function cosFromSin(sin: number, angle: number): number {
	//if (Options.FASTMATH){
	// return math_sin(angle + PIHalf);
	// }
	// sin(x)^2 + cos(x)^2 = 1
	let cos: number = sqrt(1.0 - sin * sin);
	let a: number = angle + PI_HALF;
	let b: number = a - truncate(a / PI2) * PI2;
	if (b < 0.0) b = PI2 + b;
	if (b >= PI) return -cos;
	return cos;
}

export function fma(x: number, y: number, z: number): number {
	return x * y + z;
}

export function invsqrt(r: number): number {
	return 1.0 / sqrt(r);
}

export function safeAsin(r: number): number {
	return r <= -1.0 ? -PI_HALF : r >= 1.0 ? PI_HALF : asin(r);
}

export function normalize(min: number, max: number, value: number): number {
	return value * (max - min) + min;
}
