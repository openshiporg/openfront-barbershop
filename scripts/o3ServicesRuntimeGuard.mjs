const LOCAL_DATABASE_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);
const DATABASE_NAME_PATTERN = /^runtime_barbershop_ephemeral_o3_[a-zA-Z0-9_]{8,}$/;
const ALLOWED_QUERY_OPTIONS = new Map([['schema', 'public']]);

function graphqlTypeBlock(schemaText, typeName) {
  const escapedName = typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declaration = new RegExp(`\\btype\\s+${escapedName}\\s*\\{`, 'g').exec(schemaText);
  if (!declaration) return '';

  let depth = 1;
  let quoted = false;
  let tripleQuoted = false;
  let lineComment = false;
  const start = declaration.index + declaration[0].length;
  for (let index = start; index < schemaText.length; index += 1) {
    const char = schemaText[index];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (tripleQuoted) {
      if (schemaText.startsWith('"""', index)) { tripleQuoted = false; index += 2; }
      continue;
    }
    if (quoted) {
      if (char === '\\') index += 1;
      else if (char === '"') quoted = false;
      continue;
    }
    if (schemaText.startsWith('"""', index)) { tripleQuoted = true; index += 2; continue; }
    if (char === '"') { quoted = true; continue; }
    if (char === '#') { lineComment = true; continue; }
    if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return schemaText.slice(start, index);
    }
  }
  return '';
}

export function validateO3ServicesRuntimeTarget(env) {
  if (env.O3_SERVICES_RUNTIME_OPT_IN !== '1') {
    throw new Error('O3 runtime test requires explicit O3_SERVICES_RUNTIME_OPT_IN=1.');
  }

  const databaseUrl = env.DATABASE_URL;
  const approvedUrl = env.O3_TEST_DATABASE_URL;
  if (!databaseUrl || !approvedUrl || databaseUrl !== approvedUrl) {
    throw new Error('O3 runtime test requires DATABASE_URL to exactly match the explicitly supplied O3_TEST_DATABASE_URL.');
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error('O3 runtime DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error('O3 runtime DATABASE_URL must use PostgreSQL.');
  }
  if (!LOCAL_DATABASE_HOSTS.has(parsed.hostname)) {
    throw new Error('O3 runtime DATABASE_URL must target localhost, 127.0.0.1, or ::1.');
  }
  const seenOptions = new Set();
  for (const [key, value] of parsed.searchParams) {
    if (!ALLOWED_QUERY_OPTIONS.has(key) || seenOptions.has(key) || value !== ALLOWED_QUERY_OPTIONS.get(key)) {
      throw new Error(`O3 runtime DATABASE_URL query option is not allowed: ${key}. Only one schema=public option is permitted.`);
    }
    seenOptions.add(key);
  }

  let databaseName;
  try {
    databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  } catch {
    throw new Error('O3 runtime DATABASE_URL has an invalid database name.');
  }
  if (!DATABASE_NAME_PATTERN.test(databaseName)) {
    throw new Error('O3 runtime DATABASE_URL must name an isolated runtime_barbershop_ephemeral_o3_<8+ character lease> database.');
  }
  if (parsed.hash) throw new Error('O3 runtime DATABASE_URL must not contain a fragment.');

  return { databaseUrl, databaseName };
}

export function createO3ServicesChildEnvironment(env, approvedDatabaseUrl) {
  const childEnv = { ...env };
  delete childEnv.RUN_DATABASE_TESTS;
  childEnv.DATABASE_URL = approvedDatabaseUrl;
  childEnv.O3_TEST_DATABASE_URL = approvedDatabaseUrl;
  childEnv.O3_SERVICES_RUNTIME_OPT_IN = '1';
  childEnv.DOTENV_CONFIG_PATH = '/dev/null';
  childEnv.DOTENV_CONFIG_OVERRIDE = 'false';
  childEnv.NODE_OPTIONS = '';
  return childEnv;
}

export function assertO3GeneratedArtifacts(schemaText, prismaClientExists, prismaDeclarations = '') {
  if (!prismaClientExists) throw new Error('O3 generated-contract prerequisite failed: node_modules/.prisma/client/index.js is missing.');

  const queryType = graphqlTypeBlock(schemaText, 'Query');
  const mutationType = graphqlTypeBlock(schemaText, 'Mutation');
  const projectionType = graphqlTypeBlock(schemaText, 'PlatformProjectionResult');
  const publicCategoryType = graphqlTypeBlock(schemaText, 'PublicServiceCategory');
  const required = [
    ['platformServices query', /\bplatformServices\s*:\s*PlatformProjectionResult!/.test(queryType)],
    ['public booking eligibility query', /\bgetPublicBookingEligibility\s*:\s*PlatformProjectionResult!/.test(queryType)],
    ['immutable booking policy eligibility field', /\bpublicServiceEligibility\s*:\s*BookingPolicyPublicServiceEligibilityType/.test(graphqlTypeBlock(schemaText, 'BookingPolicy'))],
    ['booking eligibility receipt', /\bbookingEligibility\s*:\s*JSON\b/.test(graphqlTypeBlock(schemaText, 'PublicBookedAppointment'))],
    ['token-authorized booking eligibility readback', /\bbookingEligibility\s*:\s*JSON\b/.test(graphqlTypeBlock(schemaText, 'PublicAppointment'))],
    ['public service catalog query', /\bgetPublicServiceCatalog\s*:\s*\[PublicServiceCategory!\]!/.test(queryType)],
    ['public booking mutation', /\bcreateOnlineBooking\s*\(/.test(mutationType)],
    ['durable guest booking command arguments', /createOnlineBooking\s*\([^)]*requestKey:\s*String![^)]*guestProof:\s*String![^)]*requestBody:\s*String!/.test(mutationType)],
    ['original guest booking recovery operation', /recoverGuestBooking\s*\([^)]*requestKey:\s*String![^)]*guestProof:\s*String![^)]*requestBody:\s*String!/.test(mutationType)],
    ['guest booking outcome disposition', /\bdisposition\s*:\s*String!/.test(graphqlTypeBlock(schemaText, 'OnlineBookingResult'))],
    ['accepted booking timezone receipt', /\bbookingTimezone\s*:\s*String!/.test(graphqlTypeBlock(schemaText, 'PublicBookedAppointment'))],
    ['generated guest command Prisma delegate', /get guestBookingCommand\(\)/.test(prismaDeclarations)],
    ['JSON scalar', /\bscalar JSON\b/.test(schemaText)],
    ['JSON projection data', /\bdata\s*:\s*JSON\b/.test(projectionType)],
    ['public category services edge', /\bservices\s*:\s*\[PublicService!\]!/.test(publicCategoryType)],
  ];
  const missing = required.filter(([, present]) => !present).map(([name]) => name);
  if (missing.length) throw new Error(`O3 generated-contract prerequisite failed; schema.graphql is missing: ${missing.join(', ')}.`);
}
