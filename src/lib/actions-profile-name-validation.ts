export interface ProfileNameInput {
  firstName: string;
  lastName: string;
}

export interface ProfileNameValidationResult {
  error?: string;
}

export function validateProfileName(input: ProfileNameInput): ProfileNameValidationResult {
  const first = input.firstName.trim();
  if (!first) return { error: "First name is required." };
  const last = input.lastName.trim();
  if (!last) return { error: "Last name is required." };
  return {};
}
