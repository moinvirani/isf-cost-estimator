/**
 * SMS Service (Twilio)
 *
 * Sends OTP codes via SMS for customer authentication.
 * In development, logs OTP to console instead of sending.
 */

// Check if Twilio is configured
export function isTwilioConfigured(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  )
}

/**
 * Send OTP code via SMS
 *
 * In development: Logs OTP to console
 * In production: Sends via Twilio
 */
export async function sendOtpSms(
  phone: string,
  otp: string
): Promise<{ success: boolean; error?: string }> {
  // In development, just log the OTP
  if (process.env.NODE_ENV === 'development' || !isTwilioConfigured()) {
    console.log('========================================')
    console.log(`[DEV] OTP for ${phone}: ${otp}`)
    console.log('========================================')
    return { success: true }
  }

  try {
    // Dynamic import to avoid issues if twilio isn't installed
    const twilio = await import('twilio')
    const client = twilio.default(
      process.env.TWILIO_ACCOUNT_SID!,
      process.env.TWILIO_AUTH_TOKEN!
    )

    await client.messages.create({
      body: `Your ISF verification code is: ${otp}. Valid for 5 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER!,
      to: phone,
    })

    return { success: true }
  } catch (error) {
    console.error('[SMS] Failed to send:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send SMS',
    }
  }
}

/**
 * Generate a random 6-digit OTP
 */
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

/**
 * Normalize phone number to E.164 format
 * Handles UAE numbers: converts 05x to +9715x
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '')

  // Handle UAE local format (05x xxx xxxx)
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '+971' + cleaned.substring(1)
  }

  // Add + if missing for numbers starting with country code
  if (!cleaned.startsWith('+') && cleaned.length > 10) {
    cleaned = '+' + cleaned
  }

  return cleaned
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const normalized = normalizePhoneNumber(phone)

  // Must be E.164 format: + followed by 10-15 digits
  const e164Regex = /^\+[1-9]\d{9,14}$/
  return e164Regex.test(normalized)
}
