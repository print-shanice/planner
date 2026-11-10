const P: Record<string, string> = {
  plus: 'M12 5v14M5 12h14',
  back: 'M15 5l-7 7 7 7',
  next: 'M9 5l7 7-7 7',
  arrow: 'M4 12h16M14 6l6 6-6 6',
  chevron: 'M6 9l6 6 6-6',
  close: 'M6 6l12 12M18 6L6 18',
  plan: 'M4 6h16M4 12h16M4 18h10',
  calendar: 'M5 5h14a1 1 0 011 1v13a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1zM4 10h16M9 3v4M15 3v4',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14',
  money: 'M3 7h18v10H3zM12 9.5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zM6 10v4M18 10v4',
  saved: 'M6 3h12v18l-6-4-6 4z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  packing: 'M5 8h14v12H5zM9 8V5h6v3M5 13h14',
  bed: 'M3 18V7M3 13h18v5M21 18v-5a3 3 0 00-3-3h-7v3M7 10.5a1.5 1.5 0 100 .01',
  plane: 'M10 20l2-6-6-2 1-2 7 1 4-5a1.5 1.5 0 012 2l-5 4 1 7-2 1-2-6-6 2',
  train: 'M7 3h10a2 2 0 012 2v9a3 3 0 01-3 3H8a3 3 0 01-3-3V5a2 2 0 012-2zM5 10h14M8 21l2-4M16 21l-2-4M9 14h.01M15 14h.01',
  bus: 'M5 4h14v12H5zM5 10h14M7 16v3M17 16v3M8 13h.01M16 13h.01',
  ferry: 'M3 17c2 2 4 2 6 0 2 2 4 2 6 0 2 2 4 2 6 0M5 14l1-5h12l1 5M9 9V6h6v3',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0114 0C19 14.8 12 21 12 21zM12 7.5a2 2 0 100 4 2 2 0 000-4z',
  note: 'M5 4h10l4 4v12H5zM15 4v4h4M8 12h8M8 16h5',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  walk: 'M13 4.5a1.5 1.5 0 100 .01M10 21l2-6 3 3v3M9 12l1-4 4 1 2 3M12 15l-2-3',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  copy: 'M8 8h12v12H8zM4 16V4h12',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  upload: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  check: 'M5 12l5 5L20 7',
  minus: 'M5 12h14',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  file: 'M7 3h7l5 5v13H7zM14 3v5h5',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20a7.5 7.5 0 0115 0',
  cafe: 'M5 9h11v5a5 5 0 01-5 5h-1a5 5 0 01-5-5V9zM16 10h1.5a2.5 2.5 0 010 5H16M8 3.5v2.5M11.5 3.5v2.5',
  restaurant: 'M7 3v8M5 3v5a2 2 0 004 0V3M7 11v10M17 21V3c-2.2 1.6-3.3 4.3-3.3 7.5H17',
  bar: 'M5 4h14l-7 8zM12 12v8M8 20h8',
  bakery: 'M4 15.5C4 11 7.6 7.5 12 7.5s8 3.5 8 8V18H4zM9 10l1 3.5M15 10l-1 3.5',
  museum: 'M3 9l9-5 9 5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18',
  sight: 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z',
  park: 'M12 21v-5M12 3l5 6.5h-2.8L18 15H6l3.8-5.5H7z',
  shopping: 'M5 8h14l-1 12H6zM9 8V6.5a3 3 0 016 0V8',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z',
}

export type IconName = keyof typeof P

export const iconPath = (name: string) => P[name] ?? ''

export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" className="icon">
      <path d={P[name] ?? ''} />
    </svg>
  )
}
