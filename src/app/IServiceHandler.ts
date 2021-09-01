import { IAccountInfo, IProfile, IPublicGeneralInfo, IShare } from "../models";
import IUser from "../models/IUser";

export default interface IServiceHandler {
    signInWithGoogle: () => Promise<IUser>;
    signOut: () => Promise<void>;
    startAuthStateListener: (listener: (user?: IUser) => void) => void;
    updateAccount: (uid: string | undefined, account: {accountInfo: IAccountInfo, publicGeneralInfo: IPublicGeneralInfo}) => Promise<void>;
    sendShare: (share: IShare) => Promise<void>;
    deleteShare: (share: IShare) => Promise<void>;
    createProfile: (uid: string | undefined, profile: IProfile) => Promise<void>;
    deleteProfile: (uid: string | undefined, profile: IProfile) => Promise<void>;
    startProfileListener: (uid: string | undefined, addListener: (profile: IProfile) => void, updateListener: (profile: IProfile) => void, deleteListener: (profile: IProfile) => void) => Promise<void>;
    startShareListener: (uid: string | undefined, profile: IProfile, addListener: (share: IShare) => void, updateListener: (share: IShare) => void, deleteListener: (share: IShare) => void) => Promise<void>;
    getAccountInfo: (uid: string | undefined) => Promise<IAccountInfo>;
    getPublicGeneralInfo: (uid: string | undefined) => Promise<IPublicGeneralInfo>;
    getUIDFromPhoneNumber: (phoneNumber: string) => Promise<string | undefined>;
    getProfileIdByName: (uid: string, profileName: string) => Promise<string | undefined>;
    getProfileNameById: (uid: string, profileId: string) => Promise<string | undefined>;
}