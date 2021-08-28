import { IAuth } from "@omnifire/api";
import IUser from "../models/IUser";
import { ErrorCode, SimpleShareError } from "../SimpleShareError";
import IAuthProvider from "./IAuthProvider";

export default class FirebaseAuthProvider implements IAuthProvider {
    private readonly auth: IAuth;

    constructor(auth: IAuth, onAuthStateChanges: (user: IUser | undefined) => void) {
        this.auth = auth;
        this.auth.onAuthStateChanged((ofUser) => {
            if (ofUser) {
                onAuthStateChanges({
                    uid: ofUser.uid,
                    displayName: ofUser.displayName || ''
                });
            } else {
                onAuthStateChanges(undefined);
            }
        });
    }

    googleSignIn = async (): Promise<IUser> => {
        try {
            const userCred = await this.auth.signInWithGoogle();
            const user = userCred.user;
            if (!user) {
                throw new SimpleShareError(
                    ErrorCode.UNEXPECTED_SIGN_IN_ERROR,
                    'User is undefined'
                );
            }
            return {
                uid: user.uid,
                displayName: user.displayName || undefined,
            };
        } catch (e) {
            throw new SimpleShareError(ErrorCode.UNEXPECTED_SIGN_IN_ERROR);
        }
    };

    signOut = async (): Promise<void> => {
        await this.auth.signOut();
    };
}