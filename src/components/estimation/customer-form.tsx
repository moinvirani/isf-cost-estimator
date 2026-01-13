'use client'

/**
 * Customer Form Component
 *
 * Collects customer information before creating a draft order.
 * Mobile-friendly with large touch targets.
 */

import { useState } from 'react'

export interface CustomerInfo {
  name: string
  phone: string
  email?: string
}

interface CustomerFormProps {
  onSubmit: (info: CustomerInfo) => void
  isLoading: boolean
}

export function CustomerForm({ onSubmit, isLoading }: CustomerFormProps) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validatePhone = (value: string): boolean => {
    // UAE phone: +971 XX XXX XXXX or 05X XXX XXXX
    const cleaned = value.replace(/\s+/g, '').replace(/-/g, '')
    const uaePattern = /^(\+971|00971|971)?0?5[0-9]{8}$/
    const intlPattern = /^\+?[1-9]\d{6,14}$/
    return uaePattern.test(cleaned) || intlPattern.test(cleaned)
  }

  const validateEmail = (value: string): boolean => {
    if (!value) return true // Optional field
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailPattern.test(value)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    const newErrors: Record<string, string> = {}

    if (!name.trim()) {
      newErrors.name = 'Customer name is required'
    }

    if (!phone.trim()) {
      newErrors.phone = 'Phone number is required'
    } else if (!validatePhone(phone)) {
      newErrors.phone = 'Enter a valid phone number'
    }

    if (email && !validateEmail(email)) {
      newErrors.email = 'Enter a valid email address'
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors)
      return
    }

    setErrors({})
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name field */}
      <div>
        <label htmlFor="customer-name" className="block text-sm font-medium text-gray-700 mb-1">
          Customer Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="customer-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter customer name"
          className={`
            w-full h-12 px-4 rounded-xl border text-base text-gray-900
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.name ? 'border-red-300 bg-red-50' : 'border-gray-300'}
          `}
          disabled={isLoading}
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600">{errors.name}</p>
        )}
      </div>

      {/* Phone field */}
      <div>
        <label htmlFor="customer-phone" className="block text-sm font-medium text-gray-700 mb-1">
          Phone Number <span className="text-red-500">*</span>
        </label>
        <input
          type="tel"
          id="customer-phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+971 50 123 4567"
          className={`
            w-full h-12 px-4 rounded-xl border text-base text-gray-900
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.phone ? 'border-red-300 bg-red-50' : 'border-gray-300'}
          `}
          disabled={isLoading}
        />
        {errors.phone && (
          <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
        )}
      </div>

      {/* Email field (optional) */}
      <div>
        <label htmlFor="customer-email" className="block text-sm font-medium text-gray-700 mb-1">
          Email <span className="text-gray-400">(optional)</span>
        </label>
        <input
          type="email"
          id="customer-email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="customer@example.com"
          className={`
            w-full h-12 px-4 rounded-xl border text-base text-gray-900
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
            ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'}
          `}
          disabled={isLoading}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-red-600">{errors.email}</p>
        )}
      </div>

      {/* Submit button */}
      <button
        type="submit"
        disabled={isLoading}
        className={`
          w-full h-14 rounded-xl font-semibold text-white text-base
          transition-colors mt-6
          ${isLoading
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 active:bg-green-800'
          }
        `}
      >
        {isLoading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Creating Draft Order...
          </span>
        ) : (
          'Create Draft Order'
        )}
      </button>
    </form>
  )
}
