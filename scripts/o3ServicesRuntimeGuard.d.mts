export type O3RuntimeEnvironment = Record<string, string | undefined>;

export function validateO3ServicesRuntimeTarget(env: O3RuntimeEnvironment): { databaseUrl: string; databaseName: string };
export function createO3ServicesChildEnvironment(env: O3RuntimeEnvironment, approvedDatabaseUrl: string): O3RuntimeEnvironment;
export function assertO3GeneratedArtifacts(schemaText: string, prismaClientExists: boolean, prismaDeclarations?: string): void;
