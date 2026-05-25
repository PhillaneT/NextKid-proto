// SA clothing sizes in order (age-based, as used in SA retail)
const CLOTHING_SCALE = ['2','3','4','5','6','7','8','9','10','11','12','13','14','16','S','M','L','XL']

function clothingIndex(size: string): number {
  return CLOTHING_SCALE.indexOf(size)
}

function clothingAtIndex(idx: number): string {
  return CLOTHING_SCALE[Math.max(0, Math.min(CLOTHING_SCALE.length - 1, idx))]
}

export interface GrowthCurveRow {
  age_weeks: number
  avg_top_size: string
  avg_bottom_size: string
  avg_shoe_size: string
}

export interface ChildMeasurement {
  top_size: string
  bottom_size: string
  shoe_size: string
  recorded_date: string
}

export interface Prediction {
  predicted_top: string
  predicted_bottom: string
  predicted_shoe: string
  confidence_score: number
  basis: 'curve_only' | 'curve_and_history' | 'history_weighted'
}

function findClosestCurve(ageWeeks: number, curves: GrowthCurveRow[]): GrowthCurveRow | null {
  if (!curves.length) return null
  return curves.reduce((best, c) =>
    Math.abs(c.age_weeks - ageWeeks) < Math.abs(best.age_weeks - ageWeeks) ? c : best
  )
}

export function ageInWeeks(dob: string): number {
  const born = new Date(dob)
  const now  = new Date()
  return Math.floor((now.getTime() - born.getTime()) / (1000 * 60 * 60 * 24 * 7))
}

export function computePrediction(
  ageWeeks: number,
  curves: GrowthCurveRow[],
  history: ChildMeasurement[],
): Prediction {
  const nextYearWeeks = ageWeeks + 52
  const nextCurve = findClosestCurve(nextYearWeeks, curves)

  if (!nextCurve) {
    return { predicted_top: '—', predicted_bottom: '—', predicted_shoe: '—', confidence_score: 0, basis: 'curve_only' }
  }

  if (history.length === 0) {
    return {
      predicted_top:    nextCurve.avg_top_size,
      predicted_bottom: nextCurve.avg_bottom_size,
      predicted_shoe:   nextCurve.avg_shoe_size,
      confidence_score: 0.60,
      basis: 'curve_only',
    }
  }

  const currentCurve = findClosestCurve(ageWeeks, curves)
  const latest = history[0]

  if (!currentCurve) {
    return {
      predicted_top:    nextCurve.avg_top_size,
      predicted_bottom: nextCurve.avg_bottom_size,
      predicted_shoe:   nextCurve.avg_shoe_size,
      confidence_score: 0.65,
      basis: 'curve_and_history',
    }
  }

  // Compute how many sizes ahead/behind the curve this child is, then
  // apply that same offset to next year's curve value.
  const topOffset = applyClothingOffset(latest.top_size, currentCurve.avg_top_size)
  const botOffset = applyClothingOffset(latest.bottom_size, currentCurve.avg_bottom_size)

  const nextTopIdx = clothingIndex(nextCurve.avg_top_size)
  const nextBotIdx = clothingIndex(nextCurve.avg_bottom_size)

  const predictedTop = nextTopIdx !== -1
    ? clothingAtIndex(nextTopIdx + topOffset)
    : nextCurve.avg_top_size

  const predictedBottom = nextBotIdx !== -1
    ? clothingAtIndex(nextBotIdx + botOffset)
    : nextCurve.avg_bottom_size

  // Shoes: return curve value (UK scale ordering is non-linear across child→adult boundary)
  const predictedShoe = nextCurve.avg_shoe_size

  const confidence = Math.round(Math.min(0.60 + history.length * 0.06, 0.90) * 100) / 100
  const basis = history.length >= 3 ? 'history_weighted' : 'curve_and_history'

  return { predicted_top: predictedTop, predicted_bottom: predictedBottom, predicted_shoe: predictedShoe, confidence_score: confidence, basis }
}

function applyClothingOffset(actual: string, curveAvg: string): number {
  const ai = clothingIndex(actual)
  const ci = clothingIndex(curveAvg)
  if (ai === -1 || ci === -1) return 0
  return ai - ci
}
