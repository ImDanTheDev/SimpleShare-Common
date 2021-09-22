import { IAccountInfo, IProfile, IPublicGeneralInfo, IShare } from "../models";
import IUser from "../models/IUser";

export default interface IServiceHandler {
    isServiceHandlerUpToDate: () => Promise<boolean>;
    signInWithGoogle: () => Promise<IUser>;
    signOut: () => Promise<void>;
    startAuthStateListener: (listener: (user?: IUser) => void) => void;
    updateAccount: (uid: string | undefined, account: {accountInfo: IAccountInfo, publicGeneralInfo: IPublicGeneralInfo}) => Promise<void>;
    sendShare: (share: IShare) => Promise<void>;
    deleteShare: (share: IShare) => Promise<void>;
    createProfile: (uid: string | undefined, profile: IProfile) => Promise<void>;
    deleteProfile: (uid: string | undefined, profile: IProfile) => Promise<void>;
    startProfileListener: (uid: string | undefined, addListener: (profile: IProfile) => void, updateListener: (profile: IProfile) => void, deleteListener: (profile: IProfile) => void) => Promise<void>;
    startShareListener: (uid: string | undefined, profile: IProfile, addListener: (share: IShare) => Promise<void>, updateListener: (share: IShare) => Promise<void>, deleteListener: (share: IShare) => Promise<void>) => Promise<void>;
    getAccountInfo: (uid: string | undefined) => Promise<IAccountInfo | undefined>;
    getPublicGeneralInfo: (uid: string | undefined) => Promise<IPublicGeneralInfo | undefined>;
    getUIDFromPhoneNumber: (phoneNumber: string) => Promise<string | undefined>;
    getProfileIdByName: (uid: string, profileName: string) => Promise<string | undefined>;
    getProfileNameById: (uid: string, profileId: string) => Promise<string | undefined>;
    uploadProfilePicture: (uid: string, pfp: Blob | {filePath: string, fileType: string}) => Promise<string>;
    deleteProfilePicture: (pfpURL: string) => Promise<void>;
    getProfilePicture: (uid: string, profileId: string) => Promise<string>;
    uploadFilePath: (ownerUID: string,  recipientUID: string, pathSrc: {filePath: string, fileType: string}) => Promise<string>;
    uploadFileBlob: (ownerUID: string, recipientUID: string, blobSrc: {blob: Blob, ext: string}) => Promise<string>;
    deleteFile: (fileURL: string) => Promise<void>;
    updateProfile: (uid: string | undefined, profile: IProfile) => Promise<void>;
}