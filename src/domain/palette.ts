import { colorDistance, isWhite, rgbToLab, toHex } from './color'
import type { Lab, Rgb } from './color'
import { MAX_CELLS } from './dimensions'
import { DEFAULT_MAX_COLORS, MAX_COLORS } from './settings'

export const MIN_COLOR_DISTANCE = 25

export interface ColorGrid {
  readonly rows: number
  readonly columns: number
  readonly palette: readonly Rgb[]
  readonly assignments: readonly number[]
}

interface Sample {
  rgb: Rgb
  lab: Lab
  count: number
}

function closest(sample: Sample, centers: readonly Sample[]): number {
  let best = 0
  for (let index = 1; index < centers.length; index++) {
    if (colorDistance(sample.lab, centers[index].lab) < colorDistance(sample.lab, centers[best].lab)) best = index
  }
  return best
}

function representative(cluster: readonly Sample[]): Sample {
  const white = cluster.find(sample => isWhite(sample.rgb))
  if (white) return white
  let best = cluster[0]
  let bestCost = Infinity
  for (const candidate of cluster) {
    const cost = cluster.reduce((sum, sample) => sum + sample.count * colorDistance(candidate.lab, sample.lab), 0)
    if (cost < bestCost) {
      bestCost = cost
      best = candidate
    }
  }
  return best
}

export function reducePalette(colors: readonly Rgb[], maximumColors = DEFAULT_MAX_COLORS): Pick<ColorGrid, 'palette' | 'assignments'> {
  if (!Number.isInteger(maximumColors) || maximumColors < 1 || maximumColors > MAX_COLORS) throw new Error('Maximum colors must be a whole number from 1 to 16.')
  if (colors.length === 0 || colors.length > MAX_CELLS) throw new Error(`Provide between 1 and ${MAX_CELLS} cell colors.`)
  const unique = new Map<string, Sample>()
  for (const rgb of colors) {
    if (rgb.some(channel => !Number.isInteger(channel) || channel < 0 || channel > 255)) {
      throw new Error('Cell colors must contain integer RGB channels from 0 to 255.')
    }
    const key = toHex(rgb)
    const existing = unique.get(key)
    if (existing) existing.count++
    else unique.set(key, { rgb, lab: rgbToLab(rgb), count: 1 })
  }
  const samples = [...unique.values()]
  const frequent = samples.reduce((best, sample) => sample.count > best.count ? sample : best)
  let centers = [samples.find(sample => isWhite(sample.rgb)) ?? frequent]
  while (centers.length < Math.min(maximumColors, samples.length)) {
    let next: Sample | undefined
    let score = -1
    for (const sample of samples) {
      if (centers.includes(sample)) continue
      const distance = colorDistance(sample.lab, centers[closest(sample, centers)].lab)
      const weightedDistance = distance * Math.sqrt(sample.count)
      if (weightedDistance > score) {
        score = weightedDistance
        next = sample
      }
    }
    if (!next) break
    centers.push(next)
  }

  const partition = () => {
    const groups = centers.map(() => [] as Sample[])
    for (const sample of samples) groups[closest(sample, centers)].push(sample)
    return groups.filter(group => group.length > 0)
  }
  for (let iteration = 0; iteration < 8; iteration++) {
    const next = partition().map(representative)
    if (next.every((sample, index) => sample === centers[index])) break
    centers = next
  }
  const clusters = partition()
  centers = clusters.map(representative)
  // Recompute after every merge: moving a medoid can make another pair too close.
  while (centers.length > 1) {
    let pair: [number, number] | undefined
    let distance = MIN_COLOR_DISTANCE
    for (let a = 0; a < centers.length; a++) {
      for (let b = a + 1; b < centers.length; b++) {
        const candidate = colorDistance(centers[a].lab, centers[b].lab)
        if (candidate < distance) {
          distance = candidate
          pair = [a, b]
        }
      }
    }
    if (!pair) break
    const [a, b] = pair
    clusters[a].push(...clusters[b])
    clusters.splice(b, 1)
    centers[a] = representative(clusters[a])
    centers.splice(b, 1)
  }
  const rawAssignments = colors.map(rgb => closest(unique.get(toHex(rgb))!, centers))
  const used = centers.filter((_, index) => rawAssignments.includes(index))
  const palette = used.map(sample => sample.rgb)
  const assignments = rawAssignments.map(index => used.indexOf(centers[index]))
  return { palette, assignments }
}
