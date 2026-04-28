import type { MockScenarioDefinition } from '@/lib/receptionist/types';

const disclosure =
  "Hi, thanks for calling. I'm an AI assistant for our plumbing company. I can help book a callback, schedule an estimate visit, or take your details for our team. I won't be able to quote exact prices on this call.";

export const MOCK_SCENARIOS: MockScenarioDefinition[] = [
  {
    id: 'mock-faucet-quote',
    name: 'Leaking faucet → quote visit',
    description: 'Homeowner wants someone to look at a kitchen faucet this week.',
    expectedOutcome: 'quote_visit_booked',
    extractedBaseline: {
      callerName: 'Jordan Lee',
      phone: '(555) 201-4488',
      address: '78 Maple St, Brooklyn, NY',
      issueType: 'faucet leak',
      issueDescription: 'Kitchen faucet dripping steadily under the sink.',
      urgency: 'low',
      preferredVisitWindow: 'Thursday or Friday afternoon',
    },
    turns: [
      { speaker: 'assistant', text: disclosure },
      {
        speaker: 'caller',
        text: "Hi, I have a kitchen faucet that's been dripping for a few days. I'd like someone to come look at it.",
      },
      {
        speaker: 'assistant',
        text: 'I can help schedule an estimate visit. May I have your name and the best phone number to reach you?',
      },
      { speaker: 'caller', text: "Jordan Lee, and my number is 555-201-4488." },
      {
        speaker: 'assistant',
        text: 'Thank you. What is the service address, and is there any water damage visible?',
      },
      {
        speaker: 'caller',
        text: "78 Maple St, Brooklyn. No damage, just the drip under the sink.",
      },
      {
        speaker: 'assistant',
        text: 'Understood. I cannot quote a price here, but we can assess on site. Do Thursday or Friday afternoon work for a visit?',
      },
      { speaker: 'caller', text: 'Friday afternoon is perfect.' },
      {
        speaker: 'assistant',
        text: "I've noted a quote visit request for Friday afternoon. Our dispatcher will confirm the exact window. Is there anything else?",
      },
      { speaker: 'caller', text: "No, that's all. Thanks." },
      {
        speaker: 'assistant',
        text: "You're welcome — we'll follow up shortly to confirm your estimate visit.",
      },
    ],
  },
  {
    id: 'mock-burst-pipe',
    name: 'Burst pipe emergency',
    description: 'Active flooding from a burst pipe — should flag emergency.',
    expectedOutcome: 'emergency',
    extractedBaseline: {
      callerName: 'Sam Rivera',
      phone: '(555) 903-2211',
      address: '220 River Rd, Queens, NY',
      issueType: 'burst pipe',
      issueDescription: 'Pipe burst in basement, water spreading.',
      urgency: 'emergency',
      preferredCallbackWindow: 'Immediately — on-site help needed',
    },
    turns: [
      { speaker: 'assistant', text: disclosure },
      {
        speaker: 'caller',
        text: 'HELP — a pipe burst in my basement and water is everywhere! I need someone now!',
      },
      {
        speaker: 'assistant',
        text: "I'm sorry this is happening. I'm flagging this as urgent for our on-call team. What's your name and address?",
      },
      { speaker: 'caller', text: "Sam Rivera, 220 River Road in Queens. It's flooding fast." },
      {
        speaker: 'assistant',
        text: 'Thank you. If you can safely do so, shut off the main water valve. I am escalating to our emergency line now.',
      },
      { speaker: 'caller', text: 'Okay, I turned the main off. Please hurry.' },
      {
        speaker: 'assistant',
        text: "I've recorded your details. A technician will call you as soon as possible. If you smell gas, leave the building and call 911.",
      },
    ],
  },
  {
    id: 'mock-callback-tomorrow',
    name: 'Callback tomorrow morning',
    description: 'Could not reach plumber — wants callback AM.',
    expectedOutcome: 'callback_booked',
    extractedBaseline: {
      callerName: 'Alex Kim',
      phone: '(555) 441-9000',
      address: '15 Court St, Brooklyn, NY',
      issueType: 'general plumbing',
      issueDescription: 'Follow-up from prior service; wants a return call.',
      urgency: 'medium',
      preferredCallbackWindow: 'Tomorrow between 9 and 11 AM',
    },
    turns: [
      { speaker: 'assistant', text: disclosure },
      {
        speaker: 'caller',
        text: "I tried calling your office twice and couldn't get through. I need someone to call me back.",
      },
      {
        speaker: 'assistant',
        text: 'I can arrange a callback. Your name and phone number?',
      },
      { speaker: 'caller', text: "Alex Kim, 555-441-9000." },
      {
        speaker: 'assistant',
        text: 'What is a good time window for our team to call you back?',
      },
      { speaker: 'caller', text: 'Tomorrow morning between 9 and 11 would be great.' },
      {
        speaker: 'assistant',
        text: "I've scheduled a callback request for tomorrow morning. What's the address on file or the issue briefly?",
      },
      {
        speaker: 'caller',
        text: '15 Court St, Brooklyn. It is about a follow-up from last week.',
      },
      {
        speaker: 'assistant',
        text: "Got it. You'll receive a callback in that window — we won't quote pricing until a technician reviews.",
      },
    ],
  },
  {
    id: 'mock-bathroom-estimate',
    name: 'Bathroom remodel estimate',
    description: 'Wants estimate for bathroom plumbing work.',
    expectedOutcome: 'quote_visit_booked',
    extractedBaseline: {
      callerName: 'Riley Chen',
      phone: '(555) 778-3344',
      address: '402 5th Ave, Brooklyn, NY',
      issueType: 'bathroom plumbing',
      issueDescription: 'Planning remodel; needs rough-in and fixture relocation estimate.',
      urgency: 'low',
      preferredVisitWindow: 'Next week any weekday morning',
    },
    turns: [
      { speaker: 'assistant', text: disclosure },
      {
        speaker: 'caller',
        text: "We're remodeling a bathroom and need an estimate for moving supply lines and a new vanity install.",
      },
      {
        speaker: 'assistant',
        text: 'We can schedule an on-site estimate. May I have your name, phone, and project address?',
      },
      { speaker: 'caller', text: "Riley Chen, 555-778-3344, 402 Fifth Avenue." },
      {
        speaker: 'assistant',
        text: 'Thanks. I cannot provide pricing on this call, but we can assess on site. When would a weekday morning next week work?',
      },
      { speaker: 'caller', text: 'Any morning next week before noon works.' },
      {
        speaker: 'assistant',
        text: "I've captured a quote visit request for next week mornings. Our team will confirm the appointment.",
      },
    ],
  },
  {
    id: 'mock-spam',
    name: 'Spam / irrelevant',
    description: 'Caller is clearly not a plumbing customer.',
    expectedOutcome: 'spam',
    extractedBaseline: {
      callerName: null,
      phone: '(555) 000-1111',
      address: null,
      issueType: 'spam',
      issueDescription: 'Unrelated sales pitch',
      urgency: 'low',
      spamLikely: true,
    },
    turns: [
      { speaker: 'assistant', text: disclosure },
      {
        speaker: 'caller',
        text: "Hi, this is an automated offer to extend your car warranty. Press 1 to continue.",
      },
      {
        speaker: 'assistant',
        text: "This line is for plumbing service requests only. If you don't need plumbing help, I'll end this session.",
      },
      { speaker: 'caller', text: 'Just press 1! Limited time!' },
      {
        speaker: 'assistant',
        text: "I'm marking this as spam and disconnecting. Goodbye.",
      },
    ],
  },
];

export function getScenarioById(id: string): MockScenarioDefinition | undefined {
  return MOCK_SCENARIOS.find((s) => s.id === id);
}
