export const CUSTOM_STATE_MAX_LENGTH = 120;

// Keep this intentionally conservative for demo safety and readability.
const CUSTOM_STATE_PATTERN = /^[a-zA-Z0-9 _.-]+$/;

export interface CustomStateValidationResult {
  normalized?: string;
  valid: boolean;
  error?: string;
}

export function validateCustomState(raw?: string | null): CustomStateValidationResult {
  const normalized = raw?.trim();

  if (!normalized) {
    return { valid: true, normalized: undefined };
  }

  if (normalized.length > CUSTOM_STATE_MAX_LENGTH) {
    return {
      valid: false,
      error: `Custom state must be ${CUSTOM_STATE_MAX_LENGTH} characters or less.`
    };
  }

  if (!CUSTOM_STATE_PATTERN.test(normalized)) {
    return {
      valid: false,
      error: 'Custom state can only include letters, numbers, spaces, dots, dashes, and underscores.'
    };
  }

  return { valid: true, normalized };
}

