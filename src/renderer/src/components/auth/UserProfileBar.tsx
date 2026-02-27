import type { AuthState } from '@shared/types/auth'
import { Button } from '../ui/Button'

interface UserProfileBarProps {
  auth: AuthState
  onSignOut: () => void
}

export function UserProfileBar({ auth, onSignOut }: UserProfileBarProps): React.JSX.Element {
  return (
    <div className="flex items-center gap-3">
      {auth.avatarUrl ? (
        <img
          src={auth.avatarUrl}
          alt={auth.displayName ?? ''}
          className="h-7 w-7 rounded-full"
        />
      ) : (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-syncbox-100 text-xs font-medium text-syncbox-700">
          {(auth.displayName ?? auth.email ?? '?')[0].toUpperCase()}
        </div>
      )}
      <span className="text-sm text-gray-700">{auth.displayName ?? auth.email}</span>
      <Button variant="ghost" size="sm" onClick={onSignOut}>
        Sign out
      </Button>
    </div>
  )
}
