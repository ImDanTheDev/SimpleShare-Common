import IAccountInfo from "../models/IAccountInfo";
import IProfile from "../models/IProfile";
import IPublicGeneralInfo from "../models/IPublicGeneralInfo";
import IShare from "../models/IShare";

export default interface IDatabaseProvider {
    // Accounts
    getAccountInfo: (uid: string) => Promise<IAccountInfo | undefined>;
    doesAccountExist: (uid: string) => Promise<boolean>;
    initializeAccount: (
        uid: string,
        accountInfo: IAccountInfo,
        publicGeneralInfo: IPublicGeneralInfo
    ) => Promise<boolean>;
    setAccountInfo: (
        uid: string,
        accountInfo: IAccountInfo
    ) => Promise<boolean>;
    getUidByPhoneNumber: (phoneNumber: string) => Promise<string | undefined>;
    getPublicGeneralInfo: (
        uid: string
    ) => Promise<IPublicGeneralInfo | undefined>;
    setPublicGeneralInfo: (
        uid: string,
        info: IPublicGeneralInfo
    ) => Promise<void>;
    // Profiles
    createDefaultProfile: (uid: string) => Promise<boolean>;
    createProfile: (uid: string, profile: IProfile) => Promise<void>;
    getAllProfiles: (uid: string) => Promise<IProfile[]>;
    getProfile: (
        uid: string,
        profileId: string
    ) => Promise<IProfile | undefined>;
    getProfileIdByName: (
        uid: string,
        name: string
    ) => Promise<string | undefined>;
    deleteProfile: (uid: string, profileId: string) => Promise<boolean>;
    addProfileListener: (uid: string) => Promise<void>;
    removeProfileListener: (uid: string) => Promise<void>;
    removeAllProfileListeners: () => Promise<void>;
    hasProfileListener: (uid: string) => boolean;
    // Shares
    createShare: (share: IShare) => Promise<void>;
    deleteShare: (share: IShare) => Promise<boolean>;
    addShareListener: (uid: string, profileId: string) => Promise<void>;
    removeShareListener: (uid: string, profileId: string) => Promise<void>;
    removeAllShareListeners: () => Promise<void>;
    hasShareListener: (uid: string, profileId: string) => boolean;
}