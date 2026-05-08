/**
 * OpenClaw Integration Module
 * 
 * This module provides utilities to integrate OpenClaw agents
 * into the WNY Automation Portal SaaS for automation purposes.
 * 
 * Use cases:
 * - AI Customer Support agents
 * - Lead qualification automation
 * - Follow-up sequences
 * - Internal workflow automation
 */

const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:18789';
const OPENCLAW_API_KEY = process.env.OPENCLAW_GATEWAY_TOKEN;

/**
 * Send a message to an OpenClaw agent
 */
export async function sendToAgent(agentId: string, message: string) {
  try {
    const response = await fetch(`${OPENCLAW_API_URL}/api/v1/agent/${agentId}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_API_KEY}`
      },
      body: JSON.stringify({ message })
    });
    
    if (!response.ok) {
      throw new Error(`OpenClaw API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('OpenClaw agent error:', error);
    throw error;
  }
}

/**
 * Create a new session with an OpenClaw agent
 */
export async function createAgentSession(agentId: string, systemPrompt?: string) {
  try {
    const response = await fetch(`${OPENCLAW_API_URL}/api/v1/agent/${agentId}/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCLAW_API_KEY}`
      },
      body: JSON.stringify({ 
        systemPrompt: systemPrompt || 'You are a helpful assistant for WNY Automation Portal.'
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenClaw API error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('OpenClaw session error:', error);
    throw error;
  }
}

/**
 * Trigger a webhook/callback when a lead comes in
 */
export async function processLeadWithAI(leadData: {
  name: string;
  phone: string;
  issue: string;
  location?: string;
}) {
  // This would integrate with OpenClaw to:
  // 1. Qualify the lead
  // 2. Determine urgency
  // 3. Route to appropriate plumber
  // 4. Send follow-up messages
  
  const prompt = `A new lead has come in:
- Name: ${leadData.name}
- Phone: ${leadData.phone}
- Issue: ${leadData.issue}
- Location: ${leadData.location || 'Not specified'}

Please analyze this lead and determine:
1. Is this a qualified lead (serious customer)?
2. What's the estimated job type?
3. Priority level (1-5)?
4. Suggested response?

Respond in JSON format.`;

  try {
    const result = await sendToAgent('lead-qualifier', prompt);
    return result;
  } catch (error) {
    console.error('Lead processing error:', error);
    return null;
  }
}

/**
 * Handle AI receptionist responses
 * This would be triggered when AI voice receives a call
 */
export async function handleIncomingCall(callerId: string, transcript: string) {
  const prompt = `A customer just called. Caller ID: ${callerId}
Transcription: ${transcript}

Determine:
1. What they need
2. Is it an emergency?
3. Schedule appointment or dispatch?
4. Message to leave with customer

Respond in JSON with action items.`;

  try {
    const result = await sendToAgent('receptionist', prompt);
    return result;
  } catch (error) {
    console.error('Call handling error:', error);
    return null;
  }
}

const openClawClient = {
  sendToAgent,
  createAgentSession,
  processLeadWithAI,
  handleIncomingCall
};

export default openClawClient;
