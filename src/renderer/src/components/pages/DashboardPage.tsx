import { useState } from 'react'
import { useStats } from '../../hooks/useStats'
import type { TransferDataPoint, StatsTimeRange } from '@shared/types/stats'

const TIME_RANGES: { label: string; value: StatsTimeRange }[] = [
  { label: 'Day', value: 'day' },
  { label: 'Week', value: 'week' },
  { label: 'Month', value: 'month' },
]

export function DashboardPage(): React.JSX.Element {
  const [range, setRange] = useState<StatsTimeRange>('day')
  const { stats, realtimePoint } = useStats(range)

  const uploadSpeed = realtimePoint ? realtimePoint.uploadBytes / 60 : 0
  const downloadSpeed = realtimePoint ? realtimePoint.downloadBytes / 60 : 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="border-b border-border px-8 py-5">
        <h1 className="text-lg font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-0.5 text-sm text-gray-500">Real-time performance and transfer statistics</p>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-8">
        {/* Live stats bar */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Upload Speed"
            value={formatSpeed(uploadSpeed)}
            color="text-blue-600"
            icon={<UpArrowIcon />}
          />
          <StatCard
            label="Download Speed"
            value={formatSpeed(downloadSpeed)}
            color="text-emerald-600"
            icon={<DownArrowIcon />}
          />
          <StatCard
            label="Files Synced Today"
            value={realtimePoint ? String(stats?.totalFilesTransferred ?? 0) : '0'}
            color="text-purple-600"
            icon={<FileIcon />}
          />
          <StatCard
            label="Active Transfers"
            value={realtimePoint ? String(realtimePoint.filesTransferred) : '0'}
            color="text-amber-600"
            icon={<SyncIcon />}
          />
        </div>

        {/* Traffic chart */}
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Transfer Traffic</h2>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              {TIME_RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    range === r.value
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <TrafficChart points={stats?.points ?? []} range={range} />
        </section>

        {/* Peak stats */}
        <div className="grid grid-cols-4 gap-4">
          <PeakCard label="Peak Upload" value={formatSpeed(stats?.peakUploadBytesPerSec ?? 0)} />
          <PeakCard label="Peak Download" value={formatSpeed(stats?.peakDownloadBytesPerSec ?? 0)} />
          <PeakCard label="Total Transferred" value={formatBytes((stats?.totalUploadBytes ?? 0) + (stats?.totalDownloadBytes ?? 0))} />
          <PeakCard label="Total Files Synced" value={String(stats?.totalFilesTransferred ?? 0)} />
        </div>
      </div>
    </div>
  )
}

function TrafficChart({ points, range }: { points: TransferDataPoint[]; range: StatsTimeRange }): React.JSX.Element {
  const W = 700
  const H = 200
  const PAD = { top: 10, right: 10, bottom: 30, left: 50 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  if (points.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-gray-50 text-sm text-gray-400">
        No transfer data yet
      </div>
    )
  }

  const maxVal = Math.max(
    ...points.map((p) => Math.max(p.uploadBytes, p.downloadBytes)),
    1,
  )

  const xScale = (i: number): number => PAD.left + (i / Math.max(points.length - 1, 1)) * chartW
  const yScale = (v: number): number => PAD.top + chartH - (v / maxVal) * chartH

  const uploadPath = buildSmoothPath(points, (p) => p.uploadBytes, xScale, yScale)
  const downloadPath = buildSmoothPath(points, (p) => p.downloadBytes, xScale, yScale)
  const uploadArea = uploadPath + ` L${xScale(points.length - 1)},${PAD.top + chartH} L${xScale(0)},${PAD.top + chartH} Z`
  const downloadArea = downloadPath + ` L${xScale(points.length - 1)},${PAD.top + chartH} L${xScale(0)},${PAD.top + chartH} Z`

  // X-axis labels
  const xLabels = getXLabels(points, range)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="uploadGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3B82F6" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#3B82F6" stopOpacity={0.02} />
        </linearGradient>
        <linearGradient id="downloadGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#10B981" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <line
          key={f}
          x1={PAD.left}
          y1={yScale(maxVal * f)}
          x2={W - PAD.right}
          y2={yScale(maxVal * f)}
          stroke="#E5E7EB"
          strokeWidth={0.5}
        />
      ))}

      {/* Y-axis labels */}
      {[0, 0.5, 1].map((f) => (
        <text
          key={f}
          x={PAD.left - 5}
          y={yScale(maxVal * f) + 4}
          textAnchor="end"
          className="fill-gray-400 text-[9px]"
        >
          {formatBytes(maxVal * f)}
        </text>
      ))}

      {/* Area fills */}
      <path d={uploadArea} fill="url(#uploadGrad)" />
      <path d={downloadArea} fill="url(#downloadGrad)" />

      {/* Lines */}
      <path d={uploadPath} fill="none" stroke="#3B82F6" strokeWidth={2} />
      <path d={downloadPath} fill="none" stroke="#10B981" strokeWidth={2} />

      {/* X-axis labels */}
      {xLabels.map((lbl, i) => (
        <text
          key={i}
          x={lbl.x}
          y={H - 5}
          textAnchor="middle"
          className="fill-gray-400 text-[9px]"
        >
          {lbl.text}
        </text>
      ))}

      {/* Legend */}
      <circle cx={PAD.left + 10} cy={H - 18} r={3} fill="#3B82F6" />
      <text x={PAD.left + 18} y={H - 15} className="fill-gray-500 text-[9px]">Upload</text>
      <circle cx={PAD.left + 60} cy={H - 18} r={3} fill="#10B981" />
      <text x={PAD.left + 68} y={H - 15} className="fill-gray-500 text-[9px]">Download</text>
    </svg>
  )
}

function buildSmoothPath(
  points: TransferDataPoint[],
  getValue: (p: TransferDataPoint) => number,
  xScale: (i: number) => number,
  yScale: (v: number) => number,
): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M${xScale(0)},${yScale(getValue(points[0]))}`

  let d = `M${xScale(0)},${yScale(getValue(points[0]))}`
  for (let i = 1; i < points.length; i++) {
    const x0 = xScale(i - 1)
    const y0 = yScale(getValue(points[i - 1]))
    const x1 = xScale(i)
    const y1 = yScale(getValue(points[i]))
    const cpx = (x0 + x1) / 2
    d += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`
  }
  return d
}

function getXLabels(points: TransferDataPoint[], range: StatsTimeRange): { x: number; text: string }[] {
  if (points.length === 0) return []
  const W = 700
  const PAD = { left: 50, right: 10 }
  const chartW = W - PAD.left - PAD.right
  const step = Math.max(1, Math.floor(points.length / 6))
  const labels: { x: number; text: string }[] = []

  for (let i = 0; i < points.length; i += step) {
    const x = PAD.left + (i / Math.max(points.length - 1, 1)) * chartW
    const d = new Date(points[i].timestamp)
    let text: string
    switch (range) {
      case 'day':
        text = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
        break
      case 'week':
        text = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
        break
      case 'month':
        text = `${d.getMonth() + 1}/${d.getDate()}`
        break
    }
    labels.push({ x, text })
  }
  return labels
}

function StatCard({ label, value, color, icon }: {
  label: string
  value: string
  color: string
  icon: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center gap-2">
        <span className={`${color}`}>{icon}</span>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`mt-2 text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}

function PeakCard({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <span className="text-xs text-gray-500">{label}</span>
      <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
    </div>
  )
}

function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec < 1024) return `${Math.round(bytesPerSec)} B/s`
  if (bytesPerSec < 1024 * 1024) return `${(bytesPerSec / 1024).toFixed(1)} KB/s`
  return `${(bytesPerSec / (1024 * 1024)).toFixed(1)} MB/s`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function UpArrowIcon(): React.JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="19" x2="12" y2="5" />
      <polyline points="5 12 12 5 19 12" />
    </svg>
  )
}

function DownArrowIcon(): React.JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="19 12 12 19 5 12" />
    </svg>
  )
}

function FileIcon(): React.JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function SyncIcon(): React.JSX.Element {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
    </svg>
  )
}
