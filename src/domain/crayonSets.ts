import { toHex } from './color'
import type { Rgb } from './color'

export interface CrayonColor {
  readonly id: string
  readonly name: string
  readonly rgb: Rgb
}

function color(id: string, name: string, hex: string): CrayonColor {
  const rgb: Rgb = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)]
  return Object.freeze({ id, name, rgb: Object.freeze(rgb) })
}

const colors = Object.freeze([
  color('blue', 'Blue', '#1F75FE'),
  color('black', 'Black', '#232323'),
  color('brown', 'Brown', '#B4674D'),
  color('green', 'Green', '#1CAC78'),
  color('orange', 'Orange', '#FF7538'),
  color('red', 'Red', '#EE204D'),
  color('violet', 'Violet (Purple)', '#926EAE'),
  color('yellow', 'Yellow', '#FCE883'),
  color('carnation-pink', 'Carnation Pink', '#FFAACC'),
  color('blue-green', 'Blue Green', '#199EBD'),
  color('blue-violet', 'Blue Violet', '#7366BD'),
  color('red-orange', 'Red Orange', '#FF5349'),
  color('red-violet', 'Red Violet', '#C0448F'),
  color('yellow-green', 'Yellow Green', '#C5E384'),
  color('yellow-orange', 'Yellow Orange', '#FFB653'),
  color('white', 'White', '#FFFFFF'),
  color('apricot', 'Apricot', '#FDD9B5'),
  color('bluetiful', 'Bluetiful', '#2E5090'),
  color('cerulean', 'Cerulean', '#1DACD6'),
  color('gray', 'Gray', '#95918C'),
  color('green-yellow', 'Green Yellow', '#F0E891'),
  color('indigo', 'Indigo', '#5D76CB'),
  color('scarlet', 'Scarlet', '#FC2847'),
  color('violet-red', 'Violet Red', '#F75394'),
  color('cadet-blue', 'Cadet Blue', '#B0B7C6'),
  color('chestnut', 'Chestnut', '#BC5D58'),
  color('melon', 'Melon', '#FDBCB4'),
  color('peach', 'Peach', '#FFCFAB'),
  color('sky-blue', 'Sky Blue', '#80DAEB'),
  color('tan', 'Tan', '#FAA76C'),
  color('timberwolf', 'Timberwolf', '#DBD7D2'),
  color('wisteria', 'Wisteria', '#CDA4DE'),
  color('burnt-sienna', 'Burnt Sienna', '#EA7E5D'),
  color('cornflower', 'Cornflower', '#9ACEEB'),
  color('goldenrod', 'Goldenrod', '#FCD975'),
  color('granny-smith-apple', 'Granny Smith Apple', '#A8E4A0'),
  color('lavender', 'Lavender', '#FCB4D5'),
  color('macaroni-and-cheese', 'Macaroni and Cheese', '#FFBD88'),
  color('mahogany', 'Mahogany', '#CD4A4A'),
  color('mauvelous', 'Mauvelous', '#EF98AA'),
  color('olive-green', 'Olive Green', '#BAB86C'),
  color('purple-mountains-majesty', "Purple Mountains' Majesty", '#9D81BA'),
  color('raw-sienna', 'Raw Sienna', '#D68A59'),
  color('salmon', 'Salmon', '#FF9BAA'),
  color('sea-green', 'Sea Green', '#9FE2BF'),
  color('sepia', 'Sepia', '#A5694F'),
  color('spring-green', 'Spring Green', '#ECEABE'),
  color('tumbleweed', 'Tumbleweed', '#DEAA88'),
])

export const CRAYON_SET_IDS = ['crayola-16', 'crayola-24', 'crayola-48'] as const
export type CrayonSetId = typeof CRAYON_SET_IDS[number]
export type OutputColorSet = 'image' | CrayonSetId

// US regular Bluetiful-era assortments; screen approximations, not measured wax colors.
export const CRAYON_REFERENCE = Object.freeze({
  edition: 'US regular / 2018-2021 reference',
  version: '1',
  membershipSource: 'https://www.jennyscrayoncollection.com/2017/10/complete-list-of-current-crayola-crayon.html',
  crossCheckSource: 'https://en.wikipedia.org/wiki/List_of_Crayola_crayon_colors',
  codeDecisions: 'Blue Violet and Brown follow cross-checked RGB; Bluetiful follows source RGB instead of swapped HEX. White is paper #FFFFFF.',
})

export const CRAYON_SETS = Object.freeze({
  'crayola-16': Object.freeze({ id: 'crayola-16', colors: Object.freeze(colors.slice(0, 16)) }),
  'crayola-24': Object.freeze({ id: 'crayola-24', colors: Object.freeze(colors.slice(0, 24)) }),
  'crayola-48': Object.freeze({ id: 'crayola-48', colors }),
})

export function isOutputColorSet(value: unknown): value is OutputColorSet {
  return value === 'image' || CRAYON_SET_IDS.some(id => id === value)
}

export function crayonForRgb(set: CrayonSetId, rgb: Rgb): CrayonColor | undefined {
  const hex = toHex(rgb)
  return CRAYON_SETS[set].colors.find(color => toHex(color.rgb) === hex)
}
