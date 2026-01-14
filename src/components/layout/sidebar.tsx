'use client'

/**
 * Sidebar Navigation Component
 *
 * Provides navigation between main app sections:
 * - Manual Estimate (/)
 * - Lead Queue (/queue)
 * - History (/estimations)
 */

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, FileText, Users, Clock, Brain, ChevronLeft, ChevronRight } from 'lucide-react'
import { UserMenu } from '@/components/auth'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  description: string
}

const navItems: NavItem[] = [
  {
    label: 'Manual Estimate',
    href: '/',
    icon: <FileText className="w-5 h-5" />,
    description: 'Upload images manually',
  },
  {
    label: 'Lead Queue',
    href: '/queue',
    icon: <Users className="w-5 h-5" />,
    description: 'Zoko conversations',
  },
  {
    label: 'AI Training',
    href: '/training',
    icon: <Brain className="w-5 h-5" />,
    description: 'Train AI from orders',
  },
  {
    label: 'History',
    href: '/estimations',
    icon: <Clock className="w-5 h-5" />,
    description: 'Past estimations',
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)

  // Check if current path matches nav item
  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Mobile menu button */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-200"
        aria-label="Toggle menu"
      >
        {isMobileOpen ? (
          <X className="w-5 h-5 text-gray-600" />
        ) : (
          <Menu className="w-5 h-5 text-gray-600" />
        )}
      </button>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full bg-white border-r border-gray-200 z-40
          transition-all duration-300 ease-in-out
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
          ${isCollapsed ? 'lg:w-16' : 'lg:w-64'}
        `}
      >
        {/* Header */}
        <div className={`p-4 border-b border-gray-200 ${isCollapsed ? 'lg:px-2' : ''}`}>
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div>
                <h1 className="font-semibold text-gray-900">ISF Estimator</h1>
                <p className="text-xs text-gray-500">Cost estimation tool</p>
              </div>
            )}
            {/* Collapse button (desktop only) */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4" />
              ) : (
                <ChevronLeft className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-colors
                  ${active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-100'
                  }
                  ${isCollapsed ? 'lg:justify-center lg:px-2' : ''}
                `}
                title={isCollapsed ? item.label : undefined}
              >
                <span className={active ? 'text-blue-600' : 'text-gray-500'}>
                  {item.icon}
                </span>
                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{item.label}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {item.description}
                    </div>
                  </div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer with User Menu */}
        <div className={`absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 ${isCollapsed ? 'flex justify-center' : ''}`}>
          <UserMenu collapsed={isCollapsed} />
          {!isCollapsed && (
            <p className="text-xs text-gray-400 text-center mt-3">
              Italian Shoe Factory
            </p>
          )}
        </div>
      </aside>
    </>
  )
}

// Export sidebar width for layout calculations
export const SIDEBAR_WIDTH = 256 // 64 * 4 = 256px (w-64)
export const SIDEBAR_COLLAPSED_WIDTH = 64 // 16 * 4 = 64px (w-16)
