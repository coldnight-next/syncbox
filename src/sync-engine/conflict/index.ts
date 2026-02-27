export {
  createClock,
  incrementClock,
  mergeClock,
  compareClock,
  type ClockComparison,
} from './vector-clock'
export {
  ConflictResolver,
  type ConflictStrategy,
  type ConflictContext,
  type ConflictResult,
} from './resolver'
