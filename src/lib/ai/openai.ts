/**
 * OpenAI Client
 *
 * Configured OpenAI client for GPT-4 Vision API calls.
 * Used for analyzing shoe/bag images to detect item type, material, condition, and issues.
 */

import OpenAI from 'openai'

// Create a singleton OpenAI client
// The API key is read from OPENAI_API_KEY environment variable automatically
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export default openai
