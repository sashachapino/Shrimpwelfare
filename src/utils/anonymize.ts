// Anonymization utility for stripping PII before sending to external APIs

export interface AnonymizationResult {
  text: string;
  replacements: string[]; // Log of what was replaced for user review
}

// Common first names to detect (extend as needed)
const COMMON_NAMES = new Set([
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles',
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen',
  'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'dorothy', 'kimberly', 'emily', 'donna', 'michelle',
  'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob',
  'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen',
  'alex', 'sam', 'taylor', 'jordan', 'casey', 'morgan', 'riley', 'jamie', 'cameron', 'drew',
  'mike', 'dave', 'bob', 'bill', 'tom', 'joe', 'jim', 'dan', 'matt', 'chris', 'steve', 'jeff', 'ben',
  'kate', 'katie', 'jenny', 'jess', 'meg', 'liz', 'beth', 'sue', 'amy', 'ann', 'kim', 'lisa', 'sara',
]);

// Patterns for detecting various PII
const PATTERNS = {
  // Email addresses
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,

  // Phone numbers (various formats)
  phone: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g,

  // Dates (various formats)
  dateSlash: /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
  dateDash: /\b\d{1,2}-\d{1,2}-\d{2,4}\b/g,
  dateWritten: /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
  dateWrittenShort: /\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,

  // Addresses (basic pattern - street numbers and names)
  streetAddress: /\b\d+\s+(?:[A-Z][a-z]+\s+){1,3}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Court|Ct|Way|Place|Pl)\.?\b/gi,

  // Zip codes
  zipCode: /\b\d{5}(?:-\d{4})?\b/g,
};

// Gender pronoun replacements
const GENDER_PRONOUNS: [RegExp, string][] = [
  // He/him/his → they/them/their
  [/\bhe\b/gi, 'they'],
  [/\bHe\b/g, 'They'],
  [/\bhim\b/gi, 'them'],
  [/\bHim\b/g, 'Them'],
  [/\bhis\b/gi, 'their'],
  [/\bHis\b/g, 'Their'],
  [/\bhimself\b/gi, 'themselves'],
  [/\bHimself\b/g, 'Themselves'],

  // She/her/hers → they/them/their
  [/\bshe\b/gi, 'they'],
  [/\bShe\b/g, 'They'],
  [/\bher\b(?!\s+(?:manager|boss|partner|parent|child|sibling|colleague|friend|therapist|doctor|coach))/gi, 'them'],
  [/\bHer\b(?!\s+(?:manager|boss|partner|parent|child|sibling|colleague|friend|therapist|doctor|coach))/g, 'Them'],
  [/\bhers\b/gi, 'theirs'],
  [/\bHers\b/g, 'Theirs'],
  [/\bherself\b/gi, 'themselves'],
  [/\bHerself\b/g, 'Themselves'],

  // Possessive "her" before nouns (her job, her life, etc.)
  [/\bher\s+(?=\w)/gi, 'their '],
  [/\bHer\s+(?=\w)/g, 'Their '],
];

// Gendered relationship terms
const GENDERED_TERMS: [RegExp, string][] = [
  // Spouse
  [/\bhusband\b/gi, 'partner'],
  [/\bwife\b/gi, 'partner'],
  [/\bspouse\b/gi, 'partner'],

  // Parents
  [/\bmother\b/gi, 'parent'],
  [/\bfather\b/gi, 'parent'],
  [/\bmom\b/gi, 'parent'],
  [/\bdad\b/gi, 'parent'],
  [/\bmommy\b/gi, 'parent'],
  [/\bdaddy\b/gi, 'parent'],

  // Children
  [/\bson\b/gi, 'child'],
  [/\bdaughter\b/gi, 'child'],

  // Siblings
  [/\bbrother\b/gi, 'sibling'],
  [/\bsister\b/gi, 'sibling'],

  // Dating
  [/\bboyfriend\b/gi, 'partner'],
  [/\bgirlfriend\b/gi, 'partner'],

  // Extended family
  [/\baunt\b/gi, 'relative'],
  [/\buncle\b/gi, 'relative'],
  [/\bniece\b/gi, 'young relative'],
  [/\bnephew\b/gi, 'young relative'],
  [/\bgrandmother\b/gi, 'grandparent'],
  [/\bgrandfather\b/gi, 'grandparent'],
  [/\bgrandma\b/gi, 'grandparent'],
  [/\bgrandpa\b/gi, 'grandparent'],

  // Gendered terms
  [/\bman\b(?!\s*-)/gi, 'person'],
  [/\bwoman\b/gi, 'person'],
  [/\bguy\b/gi, 'person'],
  [/\bgal\b/gi, 'person'],
  [/\bboy\b/gi, 'young person'],
  [/\bgirl\b/gi, 'young person'],
];

// Common job title patterns
const JOB_TITLES: RegExp[] = [
  /\b(?:senior\s+)?(?:software\s+)?engineer\b/gi,
  /\b(?:senior\s+)?developer\b/gi,
  /\b(?:senior\s+|junior\s+)?(?:product\s+)?manager\b/gi,
  /\b(?:senior\s+)?director\b/gi,
  /\bvice\s+president\b/gi,
  /\bvp\s+of\s+\w+/gi,
  /\bceo\b/gi,
  /\bcto\b/gi,
  /\bcfo\b/gi,
  /\bcoo\b/gi,
  /\bfounder\b/gi,
  /\bco-founder\b/gi,
  /\bpartner\s+at\b/gi,
  /\b(?:senior\s+)?analyst\b/gi,
  /\b(?:senior\s+)?consultant\b/gi,
  /\bteam\s+lead\b/gi,
  /\btech\s+lead\b/gi,
  /\barchitect\b/gi,
  /\bdesigner\b/gi,
  /\b(?:account\s+)?executive\b/gi,
  /\bsales\s+(?:rep|representative|manager)\b/gi,
  /\bmarketing\s+(?:manager|director)\b/gi,
  /\bhead\s+of\s+\w+/gi,
  /\bchief\s+\w+\s+officer\b/gi,
  /\battorney\b/gi,
  /\blawyer\b/gi,
  /\bdoctor\b/gi,
  /\bphysician\b/gi,
  /\bnurse\b/gi,
  /\bteacher\b/gi,
  /\bprofessor\b/gi,
  /\btherapist\b/gi,
  /\baccountant\b/gi,
];

// Common company indicators
const COMPANY_PATTERNS: RegExp[] = [
  /\bat\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\b(?=\s*(?:,|\.|\s+(?:and|where|for|as|in|since)))/g,
  /\bworks?\s+(?:at|for)\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\b/gi,
  /\bjoined\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\b/gi,
  /\bleft\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\b/gi,
  /\b([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?)\s+(?:Inc|LLC|Corp|Ltd|Co)\b/gi,
];

// Major city names
const CITIES = new Set([
  'new york', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio',
  'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus',
  'san francisco', 'charlotte', 'indianapolis', 'seattle', 'denver', 'boston', 'portland',
  'nashville', 'detroit', 'miami', 'atlanta', 'oakland', 'minneapolis', 'cleveland',
  'london', 'paris', 'tokyo', 'berlin', 'sydney', 'toronto', 'vancouver', 'dublin',
  'amsterdam', 'barcelona', 'singapore', 'hong kong', 'dubai', 'mumbai', 'bangalore',
]);

export function anonymizeText(text: string, clientName: string): AnonymizationResult {
  const replacements: string[] = [];
  let result = text;

  // 1. Replace client name (case insensitive, whole word)
  if (clientName && clientName.trim()) {
    const nameRegex = new RegExp(`\\b${escapeRegex(clientName)}\\b`, 'gi');
    if (nameRegex.test(result)) {
      replacements.push(`Client name "${clientName}" → "the client"`);
      result = result.replace(nameRegex, 'the client');
    }

    // Also try first name only if it contains a space
    const firstName = clientName.split(' ')[0];
    if (firstName && firstName.length > 2) {
      const firstNameRegex = new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'gi');
      if (firstNameRegex.test(result)) {
        replacements.push(`First name "${firstName}" → "the client"`);
        result = result.replace(firstNameRegex, 'the client');
      }
    }
  }

  // 2. Remove email addresses
  const emails = result.match(PATTERNS.email);
  if (emails) {
    replacements.push(`Removed ${emails.length} email address(es)`);
    result = result.replace(PATTERNS.email, '[email removed]');
  }

  // 3. Remove phone numbers
  const phones = result.match(PATTERNS.phone);
  if (phones) {
    replacements.push(`Removed ${phones.length} phone number(s)`);
    result = result.replace(PATTERNS.phone, '[phone removed]');
  }

  // 4. Replace dates with generic references
  let dateCount = 0;
  for (const pattern of [PATTERNS.dateSlash, PATTERNS.dateDash, PATTERNS.dateWritten, PATTERNS.dateWrittenShort]) {
    const matches = result.match(pattern);
    if (matches) {
      dateCount += matches.length;
      result = result.replace(pattern, '[date]');
    }
  }
  if (dateCount > 0) {
    replacements.push(`Replaced ${dateCount} date(s) with [date]`);
  }

  // 5. Replace street addresses
  const addresses = result.match(PATTERNS.streetAddress);
  if (addresses) {
    replacements.push(`Removed ${addresses.length} street address(es)`);
    result = result.replace(PATTERNS.streetAddress, '[address]');
  }

  // 6. Detect and replace common names in text
  const words = result.split(/\b/);
  const namesFound = new Set<string>();
  for (const word of words) {
    if (COMMON_NAMES.has(word.toLowerCase()) && word.length > 2) {
      namesFound.add(word);
    }
  }
  for (const name of namesFound) {
    const nameRegex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
    result = result.replace(nameRegex, '[person]');
  }
  if (namesFound.size > 0) {
    replacements.push(`Replaced ${namesFound.size} detected name(s): ${Array.from(namesFound).join(', ')}`);
  }

  // 7. Replace job titles
  let jobCount = 0;
  for (const pattern of JOB_TITLES) {
    if (pattern.test(result)) {
      jobCount++;
      result = result.replace(pattern, '[their role]');
    }
  }
  if (jobCount > 0) {
    replacements.push(`Replaced job title(s) with [their role]`);
  }

  // 8. Replace company names
  let companyCount = 0;
  for (const pattern of COMPANY_PATTERNS) {
    if (pattern.test(result)) {
      companyCount++;
      result = result.replace(pattern, (match) => match.replace(/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/, '[company]'));
    }
  }
  if (companyCount > 0) {
    replacements.push(`Replaced company reference(s) with [company]`);
  }

  // 9. Replace city names
  let cityCount = 0;
  for (const city of CITIES) {
    const cityRegex = new RegExp(`\\b${escapeRegex(city)}\\b`, 'gi');
    if (cityRegex.test(result)) {
      cityCount++;
      result = result.replace(cityRegex, '[city]');
    }
  }
  if (cityCount > 0) {
    replacements.push(`Replaced ${cityCount} city name(s) with [city]`);
  }

  // 10. Replace gendered relationship terms
  let genderedTermCount = 0;
  for (const [pattern, replacement] of GENDERED_TERMS) {
    if (pattern.test(result)) {
      genderedTermCount++;
      result = result.replace(pattern, replacement);
    }
  }
  if (genderedTermCount > 0) {
    replacements.push(`Neutralized gendered relationship terms`);
  }

  // 11. Replace gender pronouns (do this last to avoid double-replacement)
  let pronounCount = 0;
  for (const [pattern, replacement] of GENDER_PRONOUNS) {
    if (pattern.test(result)) {
      pronounCount++;
      result = result.replace(pattern, replacement);
    }
  }
  if (pronounCount > 0) {
    replacements.push(`Neutralized gender pronouns to they/them/their`);
  }

  return { text: result, replacements };
}

function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Anonymize full client data for API request
export interface AnonymizedClientData {
  enneagramType: string | number;
  enneagramSecondary: string | number | null;
  sessionsCompleted: number;
  allianceStrength: number;
  overallNotes: string;
  currentQuestions: string;
  sessionNotes: Array<{ sessionNumber: number; notes: string }>;
  allReplacements: string[];
}

export function anonymizeClientData(client: {
  name: string;
  enneagramType: string | number;
  enneagramSecondary: string | number | null;
  sessionsCompleted: number;
  allianceStrength: number;
  overallNotes: string;
  currentQuestions: string;
  sessionNotes: Array<{ sessionNumber: number; date: string; notes: string }>;
}): AnonymizedClientData {
  const allReplacements: string[] = [];

  // Anonymize overall notes
  const overallResult = anonymizeText(client.overallNotes || '', client.name);
  allReplacements.push(...overallResult.replacements);

  // Anonymize current questions
  const questionsResult = anonymizeText(client.currentQuestions || '', client.name);
  allReplacements.push(...questionsResult.replacements);

  // Anonymize session notes (strip dates, keep session numbers)
  const anonymizedSessions = client.sessionNotes.map((session) => {
    const sessionResult = anonymizeText(session.notes || '', client.name);
    allReplacements.push(...sessionResult.replacements.map(r => `Session ${session.sessionNumber}: ${r}`));
    return {
      sessionNumber: session.sessionNumber,
      notes: sessionResult.text,
    };
  });

  return {
    enneagramType: client.enneagramType,
    enneagramSecondary: client.enneagramSecondary,
    sessionsCompleted: client.sessionsCompleted,
    allianceStrength: client.allianceStrength,
    overallNotes: overallResult.text,
    currentQuestions: questionsResult.text,
    sessionNotes: anonymizedSessions,
    allReplacements: [...new Set(allReplacements)], // Deduplicate
  };
}
