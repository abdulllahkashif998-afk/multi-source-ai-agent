export class ChatError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "ChatError";
  }
}

// Safe diagnostic codes only: never attach statement text, quotes or source IDs.
export const citationVerificationReasons=[
  'citation_invalid_shape',
  'citation_empty_statements',
  'citation_marker_in_statement',
  'citation_unknown_source',
  'citation_quote_not_in_source',
  'citation_unknown_quote_reference',
  'citation_reference_source_mismatch',
] as const;
export type CitationVerificationReason=typeof citationVerificationReasons[number];
export class CitationVerificationError extends ChatError {
  constructor(public readonly verificationReason:CitationVerificationReason){
    super('UNSUPPORTED_ANSWER','The model did not return a verifiable answer. Please try again.',502);
  }
}
export function citationVerificationReason(error:unknown):CitationVerificationReason|undefined {
  return error instanceof CitationVerificationError && citationVerificationReasons.includes(error.verificationReason)?error.verificationReason:undefined;
}
