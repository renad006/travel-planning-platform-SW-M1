// ACC-01 / ACC-08 / ACC-07a: at least 8 characters, one letter and one digit
export const PASSWORD_REGEX = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const PASSWORD_RULE_MESSAGE =
  'Password must be at least 8 characters and include at least one letter and one digit';

// bcrypt only uses the first 72 bytes, so longer passwords are rejected
export const PASSWORD_MAX_LENGTH = 72;