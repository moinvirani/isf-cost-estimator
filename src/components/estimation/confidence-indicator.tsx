/**
 * Confidence Indicator
 *
 * Visual indicator showing AI confidence as a percentage bar.
 * Color changes based on confidence level.
 */

interface ConfidenceIndicatorProps {
  confidence: number // 0.0 to 1.0
}

export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
  const percentage = Math.round(confidence * 100)

  // Determine color based on confidence level
  const getColor = () => {
    if (confidence >= 0.8) return 'bg-green-500'
    if (confidence >= 0.6) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getLabel = () => {
    if (confidence >= 0.8) return 'High'
    if (confidence >= 0.6) return 'Medium'
    return 'Low'
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} transition-all duration-300`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-20 text-right">
        {percentage}% {getLabel()}
      </span>
    </div>
  )
}
