import { Button } from '../ui/Button'

interface SignInPanelProps {
  onSignIn: () => void
}

export function SignInPanel({ onSignIn }: SignInPanelProps): React.JSX.Element {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="max-w-sm rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="mb-2 text-2xl font-bold text-syncbox-700">Syncbox</h1>
        <p className="mb-6 text-sm text-gray-500">
          Sign in to sync files between your devices
        </p>
        <Button variant="primary" size="lg" onClick={onSignIn}>
          Sign in to Syncbox
        </Button>
        <p className="mt-4 text-xs text-gray-400">
          Opens your browser to complete sign-in
        </p>
      </div>
    </div>
  )
}
