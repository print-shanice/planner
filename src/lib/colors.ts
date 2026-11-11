// a trip's colour: one of twelve soft colours, all at the same lightness so any two sit well together.
// they only ever fill shapes (a square, a band, a day); words on them, and about them, stay in ink.
// the index is what's saved on a trip; the first six keep the hue each had before there were twelve
export const TRIP_COLOURS = 12

export const COLOUR_NAMES = ['mist blue', 'sea glass', 'lilac', 'orchid', 'butter', 'periwinkle', 'sage', 'dusty pink', 'glacier', 'mint', 'apricot', 'pistachio']

// the order the picker shows them: cool first, warm last
export const PICKER_ORDER = [0, 5, 2, 3, 8, 1, 9, 6, 11, 4, 10, 7]

export const colourIndex = (n: number | null | undefined) => (((n ?? 0) % TRIP_COLOURS) + TRIP_COLOURS) % TRIP_COLOURS

export const colourVar = (n: number | null | undefined) => `var(--g${colourIndex(n)})`
