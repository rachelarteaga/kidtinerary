import { validateProfileName } from "./actions-profile-name-validation";

export interface ProfileInput {
  firstName: string;
  lastName: string;
  address: string;
  phone: string;
}

export interface ValidationResult {
  error?: string;
}

const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/;

export function validateProfileInput(input: ProfileInput): ValidationResult {
  const nameResult = validateProfileName({
    firstName: input.firstName,
    lastName: input.lastName,
  });
  if (nameResult.error) return nameResult;

  const phone = input.phone.trim();
  if (phone && !PHONE_REGEX.test(phone)) {
    return { error: "Phone number format is invalid." };
  }

  return {};
}
