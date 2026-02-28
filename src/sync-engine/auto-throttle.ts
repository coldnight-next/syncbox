import os from 'node:os'

/**
 * Samples CPU usage over an interval by comparing idle vs total ticks.
 * Returns a value between 0 (idle) and 1 (fully loaded).
 */
export function sampleCpuUsage(intervalMs: number = 1000): Promise<number> {
  const start = cpuSnapshot()
  return new Promise((resolve) => {
    setTimeout(() => {
      const end = cpuSnapshot()
      const idleDelta = end.idle - start.idle
      const totalDelta = end.total - start.total
      resolve(totalDelta === 0 ? 0 : 1 - idleDelta / totalDelta)
    }, intervalMs)
  })
}

/**
 * Compute a bandwidth fraction based on CPU usage.
 * Returns 1.0 at <30% CPU, ramps linearly to 0.3 at >70% CPU.
 */
export function computeAutoFraction(cpuUsage: number): number {
  if (cpuUsage <= 0.3) return 1.0
  if (cpuUsage >= 0.7) return 0.3
  // Linear interpolation between 30% and 70%
  return 1.0 - ((cpuUsage - 0.3) / 0.4) * 0.7
}

function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0
  let total = 0
  for (const cpu of os.cpus()) {
    idle += cpu.times.idle
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq
  }
  return { idle, total }
}
