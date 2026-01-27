import type { Client } from '../types';
import { anonymizeClientData, type AnonymizedClientData } from './anonymize';

// Re-export for use in components
export type { AnonymizedClientData };

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export interface CoachingInsight {
  dianaChapman: { vitalMatter: string; questions: string[] };
  bruceTift: { vitalMatter: string; questions: string[] };
  jonathanShedler: { vitalMatter: string; questions: string[] };
  genpoRoshi: { vitalMatter: string; questions: string[] };
}

export interface CaseSummary {
  dianaChapman: { impression: string };
  bruceTift: { impression: string };
  jonathanShedler: { impression: string };
  genpoRoshi: { impression: string };
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

  return `You are helping a coach by generating insights from four distinct therapeutic perspectives. Review the anonymized client notes below.

IMPORTANT: The notes may be incomplete or ambiguous. You cannot know who is the coach and who is the client from the notes alone. Do not make assumptions about dynamics or what is "really" happening. Simply offer what each practitioner might notice and wonder about based on their theoretical lens.

${enneagramInfo ? enneagramInfo + '\n' : ''}Sessions completed: ${data.sessionsCompleted}
Alliance strength: ${data.allianceStrength}/10

OVERALL NOTES:
${data.overallNotes || '(none)'}

CURRENT QUESTIONS THE COACH IS HOLDING:
${data.currentQuestions || '(none)'}

SESSION NOTES:
${sessionNotesText || '(no session notes yet)'}

---

For each of the four perspectives below, provide:
1. Their sense of the "vital matter" - what seems most alive or central to this case
2. The big questions they would hold or explore

1. DIANA CHAPMAN (Conscious Leadership)
- Above/below the line awareness
- Drama triangle (victim/villain/hero)
- Fact vs. story distinction
- Body-based awareness and radical responsibility

2. BRUCE TIFT (Developmental/Relational)
- "Already Free" - nothing to fix
- Developmental trauma and adaptive strategies
- The invitation to feel what we've been avoiding
- Holding paradox rather than resolving it

3. JONATHAN SHEDLER (Psychodynamic)
- Recurring patterns and themes across relationships
- What is being enacted vs. spoken about
- Defenses as adaptations that once made sense
- The therapeutic relationship as data
- "What does the client do rather than feel?"

4. GENPO ROSHI (Big Mind Process)
- Voice dialogue with different aspects of self
- Speaking AS different voices (not about them)
- Big Mind/Big Heart - the awakened perspective
- The Controller, the Protector, the Skeptic

Respond with this exact JSON format:
{
  "dianaChapman": {
    "vitalMatter": "One sentence on what Diana Chapman would see as the vital matter",
    "questions": ["2-3 questions she would ask"]
  },
  "bruceTift": {
    "vitalMatter": "One sentence on what Bruce Tift would see as the vital matter",
    "questions": ["2-3 questions he would ask"]
  },
  "jonathanShedler": {
    "vitalMatter": "One sentence on what Jonathan Shedler would see as the vital matter",
    "questions": ["2-3 questions he would ask"]
  },
  "genpoRoshi": {
    "vitalMatter": "One sentence on what Genpo Roshi would see as the vital matter",
    "questions": ["2-3 Big Mind invitations to speak AS different voices"]
  }
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
      max_tokens: 2000,
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
    const defaultPerspective = { vitalMatter: '', questions: [] };
    return {
      dianaChapman: insight.dianaChapman || defaultPerspective,
      bruceTift: insight.bruceTift || defaultPerspective,
      jonathanShedler: insight.jonathanShedler || defaultPerspective,
      genpoRoshi: insight.genpoRoshi || defaultPerspective,
    };
  } catch {
    throw new Error('Failed to parse Claude response');
  }
}

// Build prompt for case summary (four perspectives)
function buildPlotSummaryPrompt(data: AnonymizedClientData): string {
  const sessionNotesText = data.sessionNotes
    .sort((a, b) => a.sessionNumber - b.sessionNumber)
    .map(s => `Session ${s.sessionNumber}:\n${s.notes || '(no notes)'}`)
    .join('\n\n');

  const enneagramInfo = data.enneagramType !== '?'
    ? `Enneagram: Type ${data.enneagramType}${data.enneagramSecondary ? `/${data.enneagramSecondary}` : ''}`
    : '';

  return `You are helping a coach by generating case impressions from four distinct therapeutic perspectives. Review the anonymized client notes below.

IMPORTANT: The notes may be incomplete or ambiguous. You cannot know who is the coach and who is the client from the notes alone. Do not make assumptions about dynamics or what is "really" happening. Offer pattern-matching and tentative impressions, acknowledging uncertainty.

${enneagramInfo ? enneagramInfo + '\n' : ''}Sessions completed: ${data.sessionsCompleted}
Alliance strength: ${data.allianceStrength}/10

OVERALL NOTES:
${data.overallNotes || '(none)'}

CURRENT QUESTIONS THE COACH IS HOLDING:
${data.currentQuestions || '(none)'}

SESSION NOTES:
${sessionNotesText || '(no session notes yet)'}

---

For each of the four perspectives below, provide their sense of the case - what patterns they notice, what the situation might feel like from their lens. Keep it tentative and acknowledge missing information.

1. DIANA CHAPMAN (Conscious Leadership)
- Above/below the line awareness
- Drama triangle (victim/villain/hero)
- Fact vs. story distinction
- Body-based awareness and radical responsibility

2. BRUCE TIFT (Developmental/Relational)
- "Already Free" - nothing to fix
- Developmental trauma and adaptive strategies
- The invitation to feel what we've been avoiding
- Holding paradox rather than resolving it

3. JONATHAN SHEDLER (Psychodynamic)
- Recurring patterns and themes across relationships
- What is being enacted vs. spoken about
- Defenses as adaptations that once made sense
- The therapeutic relationship as data

4. GENPO ROSHI (Big Mind Process)
- Voice dialogue with different aspects of self
- Speaking AS different voices (not about them)
- Big Mind/Big Heart - the awakened perspective
- The Controller, the Protector, the Skeptic

Respond with this exact JSON format:
{
  "dianaChapman": {
    "impression": "2-3 sentences on what Diana Chapman might notice or sense about this case, acknowledging uncertainty"
  },
  "bruceTift": {
    "impression": "2-3 sentences on what Bruce Tift might notice or sense about this case"
  },
  "jonathanShedler": {
    "impression": "2-3 sentences on what Jonathan Shedler might notice or sense about this case"
  },
  "genpoRoshi": {
    "impression": "2-3 sentences on what Genpo Roshi might notice or sense about this case"
  }
}

Respond ONLY with valid JSON, no additional text.`;
}

export function getPlotSummaryPreview(client: Client): AnonymizationPreview {
  const anonymizedData = anonymizeClientData(client);
  const promptPreview = buildPlotSummaryPrompt(anonymizedData);
  return { anonymizedData, promptPreview };
}

export async function getPlotSummary(
  apiKey: string,
  anonymizedData: AnonymizedClientData
): Promise<CaseSummary> {
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

    return JSON.parse(jsonContent) as CaseSummary;
  } catch {
    throw new Error('Failed to parse Claude response');
  }
}
