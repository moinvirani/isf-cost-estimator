'use client'

/**
 * User Menu Component
 *
 * Shows current user email and logout button.
 * Used in the sidebar footer.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User, Loader2 } from 'lucide-react'
import { signOut, onAuthStateChange } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/browser'

interface UserMenuProps {
  collapsed?: boolean
}

export function UserMenu({ collapsed = false }: UserMenuProps) {
  const router = useRouter()
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    // Get initial user
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null)
    })

    // Subscribe to auth changes
    const { data: { subscription } } = onAuthStateChange((user) => {
      setUserEmail((user as { email?: string } | null)?.email ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleLogout = async () => {
    setIsLoading(true)
    await signOut()
    router.push('/login')
    router.refresh()
  }

  if (!userEmail) {
    return null
  }

  if (collapsed) {
    return (
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className="flex items-center justify-center p-2 rounded-lg hover:bg-gray-100 text-gray-500"
        title="Sign out"
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <LogOut className="w-5 h-5" />
        )}
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {/* User info */}
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <User className="w-4 h-4 text-gray-400" />
        <span className="truncate">{userEmail}</span>
      </div>

      {/* Logout button */}
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Signing out...
          </>
        ) : (
          <>
            <LogOut className="w-4 h-4" />
            Sign out
          </>
        )}
      </button>
    </div>
  )
}
