/**
 * Customer Message Template
 *
 * Generates WhatsApp-friendly messages for customers with their
 * order summary and checkout link.
 */

export interface MessageLineItem {
  name: string
  quantity: number
  price: number
}

export interface GenerateMessageParams {
  customerName: string
  items: MessageLineItem[]
  totalPrice: number
  checkoutUrl: string
  currency?: string
}

/**
 * Generate a customer-friendly message with order details
 */
export function generateCustomerMessage(params: GenerateMessageParams): string {
  const { customerName, items, totalPrice, checkoutUrl, currency = 'AED' } = params

  // Format price helper
  const formatPrice = (amount: number) => `${currency} ${amount.toFixed(2)}`

  // Build items list
  const itemsList = items
    .map((item) => {
      const qty = item.quantity > 1 ? ` x${item.quantity}` : ''
      return `• ${item.name}${qty}: ${formatPrice(item.price * item.quantity)}`
    })
    .join('\n')

  // Get first name for greeting
  const firstName = customerName.split(' ')[0]

  const message = `Hi ${firstName}!

Thank you for choosing Italian Shoe Factory.

*Your Estimate:*
${itemsList}

*Total: ${formatPrice(totalPrice)}*

Complete your order here:
${checkoutUrl}

Questions? Just reply to this message!`

  return message
}

/**
 * Generate a shorter message variant (for SMS or quick copy)
 */
export function generateShortMessage(params: GenerateMessageParams): string {
  const { customerName, totalPrice, checkoutUrl, currency = 'AED' } = params

  const firstName = customerName.split(' ')[0]
  const formattedTotal = `${currency} ${totalPrice.toFixed(2)}`

  return `Hi ${firstName}! Your ISF estimate is ready: ${formattedTotal}. Complete your order: ${checkoutUrl}`
}
