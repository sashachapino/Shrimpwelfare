import type { Client } from '../types';
import { anonymizeClientData, type AnonymizedClientData } from './anonymize';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface CoachingInsight {
  dianaChapman: string[];
  bruceTift: string[];
  fritzPerls: string[];
}

export interface AnonymizationPreview {
  anonymizedData: AnonymizedClientData;
  promptPreview: string;
}

function buildPrompt(data: AnonymizedClientData): string {
  const sessionNotesText = data.sessionNotes
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map(s => `Session ${s.sessionNumber}:\n${s.notes || '(no notes)'}`)
    .join('\n\n');

  const enneagramInfo = data.enneagramType !== '?'
    ? `Enneagram: Type ${data.enneagramType}${data.enneagramSecondary ? `/${data.enneagramSecondary}` : ''}`
    : '';

  return `You are helping a coach by generating powerful questions from three distinct therapeutic perspectives. Review the anonymized client notes below and generate questions the coach could ask.

IMPORTANT: Do not make assumptions about what is happening or analyze patterns. The notes may be incomplete or ambiguous. Simply generate questions that each practitioner would characteristically ask based on their approach.

${enneagramInfo ? enneagramInfo + '\n' : ''}Sessions completed: ${data.sessionsCompleted}
Alliance strength: ${data.allianceStrength}/10

OVERALL NOTES:
${data.overallNotes || '(none)'}

CURRENT QUESTIONS THE COACH IS HOLDING:
${data.currentQuestions || '(none)'}

SESSION NOTES:
${sessionNotesText || '(no session notes yet)'}

---

Generate questions from these three perspectives:

1. DIANA CHAPMAN (Conscious Leadership)
- Above/below the line awareness
- Drama triangle (victim/villain/hero)
- Fact vs. story distinction
- Body-based awareness
- Radical responsibility
- "Where are you right now - above or below the line?"

2. BRUCE TIFT (Developmental/Relational)
- "Already Free" - nothing to fix
- Developmental trauma and adaptive strategies
- The invitation to feel what we've been avoiding
- Holding paradox rather than resolving it
- Relationship as practice ground
- "What if this experience is not a problem to solve?"

3. FRITZ PERLS (Gestalt)
- Present-moment awareness ("What are you aware of right now?")
- Unfinished business and incomplete gestalts
- Empty chair technique
- "How" and "what" over "why"
- Contact and withdrawal
- "What do you experience as you say that?"

Respond with this exact JSON format:
{
  "dianaChapman": [
    "3-4 questions Diana Chapman would ask, in her direct style"
  ],
  "bruceTift": [
    "3-4 questions Bruce Tift would ask, with his gentle paradoxical approach"
  ],
  "fritzPerls": [
    "3-4 questions Fritz Perls would ask, focused on present-moment experience"
  ]
}

Respond ONLY with valid JSON, no additional text.`;
}

// Get a preview of what will be sent (for user approval)
export function getAnonymizationPreview(client: Client): AnonymizationPreview {
  const anonymizedData = anonymizeClientData(client);
  const promptPreview = buildPrompt(anonymizedData);
  return { anonymizedData, promptPreview };
}

export async function getCoachingInsights(
  apiKey: string,
  anonymizedData: AnonymizedClientData
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
          content: buildPrompt(anonymizedData),
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
    // Parse the JSON response - handle potential markdown code blocks
    let jsonContent = content.trim();

    // Remove markdown code blocks if present
    const jsonMatch = jsonContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }

    // Also try to extract JSON object if there's surrounding text
    if (!jsonContent.startsWith('{')) {
      const objectMatch = jsonContent.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonContent = objectMatch[0];
      }
    }

    const insight = JSON.parse(jsonContent);
    return {
      dianaChapman: insight.dianaChapman || [],
      bruceTift: insight.bruceTift || [],
      fritzPerls: insight.fritzPerls || [],
    };
  } catch {
    throw new Error('Failed to parse Claude response');
  }
}

// Build prompt for plot summary
function buildPlotSummaryPrompt(data: AnonymizedClientData): string {
  const sessionNotesText = data.sessionNotes
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map(s => `Session ${s.sessionNumber}:\n${s.notes || '(no notes)'}`)
    .join('\n\n');

  return `You are a minimalist writer in the style of Raymond Carver. Your task is to write a brief, understated summary of this coaching engagement as if it were the arc of a short story.

Write in third person. Use simple, declarative sentences. No judgments, no analysis, no advice. Just the facts of what happened, what was explored, what shifted. Like Carver, find the quiet drama in ordinary moments.

Keep it to 3-5 short paragraphs. No more than 150 words total.

Here is the material:

Sessions completed: ${data.sessionsCompleted}

OVERALL NOTES:
${data.overallNotes || '(none)'}

SESSION NOTES:
${sessionNotesText || '(no session notes yet)'}

---

Write the plot summary now. Remember: minimal, factual, Carver-esque. No platitudes, no coaching language, no emotional interpretations. Just what happened.`;
}

export function getPlotSummaryPreview(client: Client): AnonymizationPreview {
  const anonymizedData = anonymizeClientData(client);
  const promptPreview = buildPlotSummaryPrompt(anonymizedData);
  return { anonymizedData, promptPreview };
}

export async function getPlotSummary(
  apiKey: string,
  anonymizedData: AnonymizedClientData
): Promise<string> {
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
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: buildPlotSummaryPrompt(anonymizedData),
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

  return content.trim();
}
