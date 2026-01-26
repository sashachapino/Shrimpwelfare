import type { Client } from '../types';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface CoachingInsight {
  leadingQuestions: string[];
  blindSpots: string[];
  patterns: string[];
  nextSteps: string[];
}

function buildPrompt(client: Client): string {
  const sessionNotesText = client.sessionNotes
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map(s => `Session ${s.sessionNumber} (${s.date}):\n${s.notes || '(no notes)'}`)
    .join('\n\n');

  const enneagramInfo = client.enneagramType !== '?'
    ? `Enneagram: Type ${client.enneagramType}${client.enneagramWing ? `w${client.enneagramWing}` : ''}`
    : '';

  return `You are channeling the perspective of Diana Chapman, co-author of "The 15 Commitments of Conscious Leadership" and master coach. You bring her distinctive approach: radical candor, body-based awareness, distinguishing fact from story, the drama triangle (victim/villain/hero), and the concept of being "above the line" (open, curious, committed to learning) vs "below the line" (closed, defensive, committed to being right).

Review this coaching client's information and provide insights to help the coach (not the client directly).

CLIENT: ${client.name}
${enneagramInfo}
Sessions completed: ${client.sessionsCompleted}
Alliance strength: ${client.allianceStrength}/10

OVERALL NOTES:
${client.overallNotes || '(none)'}

CURRENT QUESTIONS THE COACH IS HOLDING:
${client.currentQuestions || '(none)'}

SESSION NOTES:
${sessionNotesText || '(no session notes yet)'}

---

As Diana Chapman would, provide your insights in this exact JSON format:
{
  "leadingQuestions": [
    "3-5 powerful questions the coach might ask to catalyze transformation, in Diana's direct style"
  ],
  "blindSpots": [
    "2-4 things the coach might be missing in the relational dynamic, patterns they may not be seeing, or ways they might be colluding with the client's story"
  ],
  "patterns": [
    "2-3 patterns Diana would notice in the client's material - where are they below the line? What drama triangle roles are they playing?"
  ],
  "nextSteps": [
    "2-3 concrete suggestions for the next session, in Diana's practical style"
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

export async function getCoachingInsights(
  apiKey: string,
  client: Client
): Promise<CoachingInsight> {
  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: buildPrompt(client),
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.content?.[0]?.text;

  if (!content) {
    throw new Error('No response from Claude');
  }

  try {
    // Parse the JSON response
    const insight = JSON.parse(content);
    return {
      leadingQuestions: insight.leadingQuestions || [],
      blindSpots: insight.blindSpots || [],
      patterns: insight.patterns || [],
      nextSteps: insight.nextSteps || [],
    };
  } catch {
    throw new Error('Failed to parse Claude response');
  }
}
