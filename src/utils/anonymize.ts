// Anonymization utility for stripping PII before sending to external APIs

export interface AnonymizationResult {
  text: string;
  replacements: string[]; // Log of what was replaced for user review
}

// Common first names to detect (extend as needed)
const COMMON_NAMES = new Set([
  // Male names
  'james', 'john', 'robert', 'michael', 'william', 'david', 'richard', 'joseph', 'thomas', 'charles',
  'christopher', 'daniel', 'matthew', 'anthony', 'mark', 'donald', 'steven', 'paul', 'andrew', 'joshua',
  'kevin', 'brian', 'george', 'edward', 'ronald', 'timothy', 'jason', 'jeffrey', 'ryan', 'jacob',
  'adam', 'nathan', 'henry', 'peter', 'scott', 'patrick', 'jack', 'dennis', 'jerry', 'tyler',
  'aaron', 'jose', 'douglas', 'noah', 'ethan', 'jeremy', 'walter', 'christian', 'keith', 'roger',
  'terry', 'austin', 'sean', 'gerald', 'carl', 'harold', 'dylan', 'arthur', 'lawrence', 'jordan',
  'jesse', 'bryan', 'billy', 'bruce', 'gabriel', 'joe', 'logan', 'albert', 'willie', 'alan',
  'eugene', 'russell', 'vincent', 'philip', 'bobby', 'johnny', 'bradley', 'roy', 'ralph', 'eugene',
  // Female names
  'mary', 'patricia', 'jennifer', 'linda', 'elizabeth', 'barbara', 'susan', 'jessica', 'sarah', 'karen',
  'nancy', 'betty', 'margaret', 'sandra', 'ashley', 'dorothy', 'kimberly', 'emily', 'donna', 'michelle',
  'carol', 'amanda', 'melissa', 'deborah', 'stephanie', 'rebecca', 'sharon', 'laura', 'cynthia', 'kathleen',
  'amy', 'angela', 'shirley', 'anna', 'brenda', 'pamela', 'emma', 'nicole', 'helen', 'samantha',
  'katherine', 'christine', 'debra', 'rachel', 'carolyn', 'janet', 'catherine', 'maria', 'heather', 'diane',
  'ruth', 'julie', 'olivia', 'joyce', 'virginia', 'victoria', 'kelly', 'lauren', 'christina', 'joan',
  'evelyn', 'judith', 'megan', 'andrea', 'cheryl', 'hannah', 'jacqueline', 'martha', 'gloria', 'teresa',
  'ann', 'sara', 'madison', 'frances', 'kathryn', 'janice', 'jean', 'abigail', 'alice', 'judy',
  'sophia', 'grace', 'denise', 'amber', 'doris', 'marilyn', 'danielle', 'beverly', 'isabella', 'theresa',
  'diana', 'natalie', 'brittany', 'charlotte', 'marie', 'kayla', 'alexis', 'lori', 'julia', 'tanya', 'tania',
  // Gender-neutral / additional names
  'alex', 'sam', 'taylor', 'jordan', 'casey', 'morgan', 'riley', 'jamie', 'cameron', 'drew',
  'avery', 'peyton', 'quinn', 'skyler', 'charlie', 'finley', 'sage', 'rowan', 'hayden', 'reese',
  // Nicknames and short forms
  'mike', 'dave', 'bob', 'bill', 'tom', 'joe', 'jim', 'dan', 'matt', 'chris', 'steve', 'jeff', 'ben',
  'kate', 'katie', 'jenny', 'jess', 'meg', 'liz', 'beth', 'sue', 'kim', 'lisa', 'vicky', 'becky',
  'tony', 'nick', 'rick', 'will', 'ed', 'ted', 'rob', 'jon', 'tim', 'greg', 'larry', 'harry',
  'abby', 'ally', 'angie', 'barb', 'carrie', 'cathy', 'cindy', 'deb', 'debbie', 'gabby', 'jackie',
  'jan', 'kat', 'kathy', 'maggie', 'mandy', 'margie', 'mia', 'pam', 'patty', 'penny', 'sandy', 'steph',
  'tina', 'trish', 'val', 'wendy', 'zoe',
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
  // Religious titles
  /\b(?:unitarian\s+universalist\s+)?minister\b/gi,
  /\bpastor\b/gi,
  /\breverend\b/gi,
  /\brev\.\b/gi,
  /\bpriest\b/gi,
  /\brabbi\b/gi,
  /\bimam\b/gi,
  /\bchaplain\b/gi,
  /\bdeacon\b/gi,
  /\bbishop\b/gi,
  /\bcantor\b/gi,
  /\belder\b/gi,
  /\bpastor\b/gi,
  // Healthcare
  /\bpsychologist\b/gi,
  /\bpsychiatrist\b/gi,
  /\bcounselor\b/gi,
  /\bsocial\s+worker\b/gi,
  // Other professions
  /\bwriter\b/gi,
  /\bjournalist\b/gi,
  /\beditor\b/gi,
  /\bartist\b/gi,
  /\bmusician\b/gi,
  /\bactor\b/gi,
  /\bchef\b/gi,
  /\bpilot\b/gi,
  /\bscientist\b/gi,
  /\bresearcher\b/gi,
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
    const before = result;
    result = result.replace(nameRegex, 'the client');
    if (result !== before) {
      replacements.push(`Client name "${clientName}" → "the client"`);
    }

    // Also try first name only if it contains a space
    const firstName = clientName.split(' ')[0];
    if (firstName && firstName.length > 2) {
      const firstNameRegex = new RegExp(`\\b${escapeRegex(firstName)}\\b`, 'gi');
      const beforeFirst = result;
      result = result.replace(firstNameRegex, 'the client');
      if (result !== beforeFirst) {
        replacements.push(`First name "${firstName}" → "the client"`);
      }
    }
  }

  // 2. Remove email addresses
  PATTERNS.email.lastIndex = 0;
  const emails = result.match(PATTERNS.email);
  if (emails) {
    replacements.push(`Removed ${emails.length} email address(es)`);
    PATTERNS.email.lastIndex = 0;
    result = result.replace(PATTERNS.email, '[email removed]');
  }

  // 3. Remove phone numbers
  PATTERNS.phone.lastIndex = 0;
  const phones = result.match(PATTERNS.phone);
  if (phones) {
    replacements.push(`Removed ${phones.length} phone number(s)`);
    PATTERNS.phone.lastIndex = 0;
    result = result.replace(PATTERNS.phone, '[phone removed]');
  }

  // 4. Replace dates with generic references
  let dateCount = 0;
  for (const pattern of [PATTERNS.dateSlash, PATTERNS.dateDash, PATTERNS.dateWritten, PATTERNS.dateWrittenShort]) {
    pattern.lastIndex = 0;
    const matches = result.match(pattern);
    if (matches) {
      dateCount += matches.length;
      pattern.lastIndex = 0;
      result = result.replace(pattern, '[date]');
    }
  }
  if (dateCount > 0) {
    replacements.push(`Replaced ${dateCount} date(s) with [date]`);
  }

  // 5. Replace street addresses
  PATTERNS.streetAddress.lastIndex = 0;
  const addresses = result.match(PATTERNS.streetAddress);
  if (addresses) {
    replacements.push(`Removed ${addresses.length} street address(es)`);
    PATTERNS.streetAddress.lastIndex = 0;
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
    pattern.lastIndex = 0; // Reset global regex state
    const before = result;
    result = result.replace(pattern, '[their role]');
    if (result !== before) jobCount++;
  }
  if (jobCount > 0) {
    replacements.push(`Replaced job title(s) with [their role]`);
  }

  // 8. Replace company names
  let companyCount = 0;
  for (const pattern of COMPANY_PATTERNS) {
    pattern.lastIndex = 0; // Reset global regex state
    const before = result;
    result = result.replace(pattern, (match) => match.replace(/[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)?/, '[company]'));
    if (result !== before) companyCount++;
  }
  if (companyCount > 0) {
    replacements.push(`Replaced company reference(s) with [company]`);
  }

  // 9. Replace city names
  let cityCount = 0;
  for (const city of CITIES) {
    const cityRegex = new RegExp(`\\b${escapeRegex(city)}\\b`, 'gi');
    const before = result;
    result = result.replace(cityRegex, '[city]');
    if (result !== before) cityCount++;
  }
  if (cityCount > 0) {
    replacements.push(`Replaced ${cityCount} city name(s) with [city]`);
  }

  // 10. Replace gendered relationship terms
  let genderedTermCount = 0;
  for (const [pattern, replacement] of GENDERED_TERMS) {
    pattern.lastIndex = 0; // Reset global regex state
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) genderedTermCount++;
  }
  if (genderedTermCount > 0) {
    replacements.push(`Neutralized gendered relationship terms`);
  }

  // 11. Replace gender pronouns (do this last to avoid double-replacement)
  let pronounCount = 0;
  for (const [pattern, replacement] of GENDER_PRONOUNS) {
    pattern.lastIndex = 0; // Reset global regex state
    const before = result;
    result = result.replace(pattern, replacement);
    if (result !== before) pronounCount++;
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
  const clientName = client.name || '';
  const sessionNotes = Array.isArray(client.sessionNotes) ? client.sessionNotes : [];

  // Anonymize overall notes
  const overallResult = anonymizeText(client.overallNotes || '', clientName);
  allReplacements.push(...overallResult.replacements);

  // Anonymize current questions
  const questionsResult = anonymizeText(client.currentQuestions || '', clientName);
  allReplacements.push(...questionsResult.replacements);

  // Anonymize session notes (strip dates, keep session numbers)
  const anonymizedSessions = sessionNotes.map((session) => {
    const sessionResult = anonymizeText(session?.notes || '', clientName);
    allReplacements.push(...sessionResult.replacements.map(r => `Session ${session?.sessionNumber ?? 0}: ${r}`));
    return {
      sessionNumber: session?.sessionNumber ?? 0,
      notes: sessionResult.text,
    };
  });

  return {
    enneagramType: client.enneagramType ?? '?',
    enneagramSecondary: client.enneagramSecondary ?? null,
    sessionsCompleted: client.sessionsCompleted ?? 0,
    allianceStrength: client.allianceStrength ?? 5,
    overallNotes: overallResult.text,
    currentQuestions: questionsResult.text,
    sessionNotes: anonymizedSessions,
    allReplacements: [...new Set(allReplacements)], // Deduplicate
  };
}
