// a number of things in words: "1 night", "3 nights", "1,204 reviews"
export const count = (n: number, one: string, many = `${one}s`): string => `${n.toLocaleString('en-GB')} ${n === 1 ? one : many}`
