export interface Participant {
  name: string
  seed: number
  country: string
  username?: string
}

export const season3: Participant[] = [
  { name: 'ZacMuffin',     seed: 1,  country: 'US', username: 'Zacc' },
  { name: 'Dragon76',      seed: 2,  country: 'FI', username: 'Dragon67' },
  { name: 'itsjared97',    seed: 3,  country: 'US' },
  { name: 'ERoadhouse',    seed: 4,  country: 'US' },
  { name: 'AnorakDT',      seed: 5,  country: 'US' },
  { name: 'Bricko',        seed: 6,  country: 'US' },
  { name: 'Scynor',        seed: 7,  country: 'US' },
  { name: 'WiiSuper',      seed: 8,  country: 'US' },
  { name: 'Wazzip',        seed: 9,  country: 'US' },
  { name: 'FlamingLazer',  seed: 10, country: 'CA' },
  { name: 'Dimei',         seed: 11, country: 'US' },
  { name: 'ejpman',        seed: 12, country: 'US' },
  { name: 'Colten',        seed: 13, country: 'US', username: 'colten8' },
  { name: 'kwazrr',        seed: 14, country: 'BE' },
  { name: 'GildetPhantom', seed: 15, country: 'DE' },
  { name: 'Charzight',     seed: 16, country: 'US' },
  { name: 'Coolisen',      seed: 17, country: 'SE', username: 'Coolisengaming2' },
  { name: 'MelloVro',      seed: 18, country: 'US' },
  { name: 'Gamer_Olive',   seed: 19, country: 'AU', username: 'Gamer_Olive666' },
  { name: 'thenzota',      seed: 20, country: 'NZ' },
  { name: 'Wytew',         seed: 21, country: 'GB-WLS' },
  { name: 'ChessWiz',      seed: 22, country: 'US' },
  { name: 'Nolan',         seed: 23, country: 'US', username: 'Nolan_' },
  { name: 'AppleMan',      seed: 24, country: 'AU', username: 'The_AppleMan' },
  { name: 'CaptainPaxo',   seed: 25, country: 'UK' },
  { name: 'doubtt',        seed: 26, country: 'US', username: '_doubtt' },
  { name: 'Chroma_Q',      seed: 27, country: 'US' },
  { name: 'Staunch',       seed: 28, country: 'US' },
]

export const season2: Participant[] = [
  { name: 'itsjared97',   seed: 1,  country: 'US' },
  { name: 'FrostByte',    seed: 2,  country: 'US', username: 'Frost_Byte' },
  { name: 'WiiSuper',     seed: 3,  country: 'US' },
  { name: 'Scynor',       seed: 4,  country: 'US' },
  { name: 'Herasmie',     seed: 5,  country: 'FI' },
  { name: 'AnorakDT',     seed: 6,  country: 'US' },
  { name: 'Dragon67',     seed: 7,  country: 'FI' },
  { name: 'FlamingLazer', seed: 8,  country: 'CA' },
  { name: 'Dimei',        seed: 9,  country: 'US' },
  { name: 'flup',         seed: 10, country: 'CA' },
  { name: 'Coolisen',     seed: 11, country: 'SE', username: 'Coolisengaming2' },
  { name: 'Revvylo',      seed: 12, country: 'GB-ENG' },
  { name: 'TwiceLyte',    seed: 13, country: 'US', username: 'TwiceLyte_' },
  { name: 'GildetPhantom',seed: 14, country: 'DE' },
  { name: 'Tfresh',       seed: 15, country: 'US' },
  { name: 'thenzota',     seed: 16, country: 'NZ' },
  { name: 'Charzight',    seed: 17, country: 'US' },
  { name: 'kwazrr',       seed: 18, country: 'BE' },
  { name: 'Anonymous',    seed: 19, country: 'US', username: 'AnAnonymousSource' },
  { name: 'Biksel',       seed: 20, country: 'FI' },
  { name: 'yahootles',    seed: 21, country: 'CA' },
  { name: 'Nolan',        seed: 22, country: 'US', username: 'Nolan_' },
  { name: 'Gamer_Olive',  seed: 23, country: 'AU', username: 'Gamer_Olive666' },
  { name: 'Chroma_Q',     seed: 24, country: 'US' },
  { name: 'AppleMan',     seed: 25, country: 'AU', username: 'The_AppleMan' },
  { name: 'Bennymoon',    seed: 26, country: 'US', username: 'Bennymoon129' },
]

export function getSeed(runnerName: string): number | null {
  const p = season3.find(
    p => p.name.toLowerCase() === runnerName.toLowerCase() ||
         p.username?.toLowerCase() === runnerName.toLowerCase()
  )
  return p?.seed ?? null
}
