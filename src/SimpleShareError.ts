export class SimpleShareError extends Error {
    readonly code: ErrorCode;
    readonly additionalInfo: string | undefined;

    constructor(code: ErrorCode, additionalInfo?: string) {
        super(code);
        this.name = 'SimpleShareError';
        this.code = code;
        this.additionalInfo = additionalInfo;
    }
}

export enum ErrorCode {
    // Auth Errors
    SIGN_IN_UNEXPECTED_ERROR = 'An unexpected error occurred during the sign in.',
    SIGN_IN_CANCELLED = 'The user cancelled the sign in operation.',
    SIGN_IN_INVALID_CREDENTIALS = 'The credentials are invalid.',
    SIGN_IN_BLOCKED = 'Auth sign in popup was blocked.',
    SIGN_IN_POPUP_ALREADY_OPENED = 'The sign in popup is already open.',
    SIGN_IN_EXPIRED_TOKEN = `The user's credential has expired and needs to sign in again.`,
    SIGN_IN_EMAIL_UNVERIFIED = `The user's email is unverified.`,
    SIGN_IN_ACCOUNT_DISABLED = `The user's account is disabled.`,
    SIGN_IN_USER_NOT_FOUND = 'The sign in operation did not return a user account.',
    // Database Errors
    USER_DOES_NOT_EXIST = 'The user does not exist.',
    PROFILE_DOES_NOT_EXIST = 'The profile does not exist.',
    UNEXPECTED_DATABASE_ERROR = 'An unexpected error occurred with the database.',
    // Misc. Errors
    NOT_SIGNED_IN = 'The user is not signed in.',
    NO_PROFILE_SELECTED = 'The user does not have a profile selected.',
    NO_NETWORK_CONNECTION = 'A network connection is not available.',
    APP_ERROR = 'An unexpected error occurred with the application.',
}
