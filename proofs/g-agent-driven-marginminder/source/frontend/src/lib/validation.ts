/** Minimum password length — must match backend PASSWORD_MIN_LENGTH */
const PASSWORD_MIN_LENGTH = 8;

/** Minimum username length — must match backend TypeBox schema */
const USERNAME_MIN_LENGTH = 2;

/** Maximum username length — must match backend TypeBox schema */
const USERNAME_MAX_LENGTH = 50;

/** Truncation threshold for data viewer cell values */
const CELL_TRUNCATION_LENGTH = 80;

/** Simple email format validation matching user@domain.tld pattern. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validate that a string looks like a valid email address.
 * Uses a simple but effective pattern that checks for:
 * - No spaces or @ signs before the @ symbol
 * - An @ symbol separating local and domain parts
 * - A dot in the domain part
 *
 * @param email - The email address to validate
 * @returns true if email format is valid
 */
function isValidEmail(email: string): boolean {
	return EMAIL_PATTERN.test(email);
}

/**
 * Validate password and confirmation match, and meet minimum length.
 * @returns Error message string on failure, null on success.
 */
function validatePasswordMatch(password: string, confirmPassword: string): null | string {
	if (password !== confirmPassword) {
		return 'Passwords do not match';
	}
	if (password.length < PASSWORD_MIN_LENGTH) {
		return `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
	}
	return null;
}

export {
	CELL_TRUNCATION_LENGTH,
	isValidEmail,
	PASSWORD_MIN_LENGTH,
	USERNAME_MAX_LENGTH,
	USERNAME_MIN_LENGTH,
	validatePasswordMatch,
};
