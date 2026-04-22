export interface ProfileInput {
  fullName: string;
  address: string;
  phone: string;
}

export interface ValidationResult {
  error?: string;
}

const PHONE_REGEX = /^[+]?[0-9()\-\s]{7,20}$/;

export function validateProfileInput(input: ProfileInput): ValidationResult {
  const name = input.fullName.trim();
  if (!name) return { error: "Name is required." };

  const phone = input.phone.trim();
  if (phone && !PHONE_REGEX.test(phone)) {
    return { error: "Phone number format is invalid." };
  }

  return {};
}
