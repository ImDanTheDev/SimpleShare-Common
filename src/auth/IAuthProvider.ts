import IUser from "../models/IUser";

export default interface IAuthProvider {
    googleSignIn: () => Promise<IUser>;
    signOut: () => Promise<void>;
}
