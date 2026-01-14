/**
 * Login Page
 *
 * Staff login page for ISF Cost Estimator.
 */

import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/login-form'

export const metadata = {
  title: 'Login - ISF Cost Estimator',
  description: 'Staff login for Italian Shoe Factory',
}

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo/Title */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">ISF Cost Estimator</h1>
          <p className="text-gray-500 mt-1">Staff Login</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <Suspense fallback={<div className="h-48 flex items-center justify-center">Loading...</div>}>
            <LoginForm />
          </Suspense>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-gray-400 mt-6">
          Italian Shoe Factory - Internal Tool
        </p>
      </div>
    </div>
  )
}
