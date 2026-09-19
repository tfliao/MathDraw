export type Rgb = readonly [number, number, number]
export type Lab = readonly [number, number, number]

export function srgbToLinear(channel: number): number {
  const value = channel / 255
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

export function linearToSrgb(value: number): number {
  const channel = value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055
  return Math.round(Math.min(1, Math.max(0, channel)) * 255)
}

export function rgbToLab(rgb: Rgb): Lab {
  const [r, g, b] = rgb.map(srgbToLinear)
  const curve = (value: number) => value > (6 / 29) ** 3 ? Math.cbrt(value) : value / (3 * (6 / 29) ** 2) + 4 / 29
  const x = curve((r * 0.4124564 + g * 0.3575761 + b * 0.1804375) / 0.95047)
  const y = curve(r * 0.2126729 + g * 0.7151522 + b * 0.072175)
  const z = curve((r * 0.0193339 + g * 0.119192 + b * 0.9503041) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

export function colorDistance(a: Lab, b: Lab): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2])
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map(channel => channel.toString(16).padStart(2, '0')).join('')}`
}

export function isWhite(rgb: Rgb): boolean {
  return rgb.every(channel => channel === 255)
}

export function isNearWhite(rgb: Rgb): boolean {
  return rgb.every(channel => channel >= 240)
}
