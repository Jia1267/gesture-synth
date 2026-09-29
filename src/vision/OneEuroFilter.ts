/**
 * One Euro filter (Casiez et al. 2012): heavy smoothing when a point is still,
 * little lag when it moves fast. Tuned for normalized 0–1 image coordinates.
 */
export class OneEuroFilter {
  private x: number | null = null
  private dx = 0
  private t = 0
  private minCutoff: number
  private beta: number
  private dCutoff: number

  constructor(minCutoff = 1.5, beta = 8, dCutoff = 1) {
    this.minCutoff = minCutoff
    this.beta = beta
    this.dCutoff = dCutoff
  }

  filter(value: number, tSec: number) {
    if (this.x === null) {
      this.x = value
      this.t = tSec
      return value
    }
    const dt = Math.max(tSec - this.t, 1e-3)
    this.t = tSec
    this.dx += alpha(this.dCutoff, dt) * ((value - this.x) / dt - this.dx)
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx)
    this.x += alpha(cutoff, dt) * (value - this.x)
    return this.x
  }
}

function alpha(cutoff: number, dt: number) {
  const tau = 1 / (2 * Math.PI * cutoff)
  return 1 / (1 + tau / dt)
}
