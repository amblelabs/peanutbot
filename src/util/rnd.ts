function getRandomIntInclusive(min: number, max: number): number {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(c: T[]): T {
	return c[getRandomIntInclusive(0, c.length - 1)];
}

export default {
    getRandomIntInclusive,
    pickRandom,
}