import IAccountInfo from "../models/IAccountInfo";
import IDatabaseProvider from "./IDatabaseProvider";
import {IFirestore} from '@omnifire/api';
import IPublicGeneralInfo from "../models/IPublicGeneralInfo";
import IProfile from "../models/IProfile";
import IShare from "../models/IShare";
import { ErrorCode, SimpleShareError } from "../SimpleShareError";

interface IShareListener {
    uid: string;
    profileId: string;
    unsubscribe: () => void;
}

interface IProfileListener {
    uid: string;
    unsubscribe: () => void;
}


export default class FirebaseDatabaseProvider implements IDatabaseProvider {
    private readonly db: IFirestore;

    private readonly onShareAddedCallback: (share: IShare) => void;
    private readonly onShareDeletedCallback: (share: IShare) => void;
    private readonly onShareModifiedCallback: (share: IShare) => void;
    private readonly onProfileAddedCallback: (profile: IProfile) => void;
    private readonly onProfileDeletedCallback: (profile: IProfile) => void;
    private readonly onProfileModifiedCallback: (profile: IProfile) => void;

    private shareListeners: IShareListener[] = [];
    private profileListeners: IProfileListener[] = [];

    constructor(
        db: IFirestore,
        onShareAdded: (share: IShare) => void,
        onShareDeleted: (share: IShare) => void,
        onShareModified: (share: IShare) => void,
        onProfileAdded: (profile: IProfile) => void,
        onProfileDeleted: (profile: IProfile) => void,
        onProfileModified: (profile: IProfile) => void
    ) {
        this.db = db;
        this.onShareAddedCallback = onShareAdded;
        this.onShareDeletedCallback = onShareDeleted;
        this.onShareModifiedCallback = onShareModified;
        this.onProfileAddedCallback = onProfileAdded;
        this.onProfileDeletedCallback = onProfileDeleted;
        this.onProfileModifiedCallback = onProfileModified;
    }

    getAccountInfo = async (uid: string): Promise<IAccountInfo | undefined> => {
        try {
            const accountDocRef = this.db.collection('accounts').doc(uid);
            const accountDoc = await accountDocRef.get();

            if (accountDoc.exists) {
                const accountDocData = accountDoc.data();
                if (accountDocData) {
                    return {
                        isAccountComplete: accountDocData.isAccountComplete,
                        phoneNumber: accountDocData.phoneNumber
                    };
                }
            }
        } catch (e) {
            return undefined;
        }
        return undefined;
    }

    doesAccountExist = async (uid: string): Promise<boolean> => {
        try {
            const accountDocRef = this.db
                .collection('accounts')
                .doc(uid);
            const accountDoc = await accountDocRef.get();
            return accountDoc.exists;
        } catch {
            return false;
        }
    };

    initializeAccount = async (
        uid: string,
        accountInfo: IAccountInfo,
        publicGeneralInfo: IPublicGeneralInfo
    ): Promise<boolean> => {
        const setAccountInfo = await this.setAccountInfo(uid, accountInfo);
        if (!setAccountInfo) return false;

        try {
            await this.setPublicGeneralInfo(uid, publicGeneralInfo);
        } catch {
            return false;
        }

        return await this.createDefaultProfile(uid);
    };

    setAccountInfo = async (
        uid: string,
        accountInfo: IAccountInfo
    ): Promise<boolean> => {
        try {
            const accountDocRef = this.db
                .collection('accounts')
                .doc(uid);
            await accountDocRef.set(accountInfo);
            return true;
        } catch (e) {
            return false;
        }
    };

    getUidByPhoneNumber = async (
        phoneNumber: string
    ): Promise<string | undefined> => {
        const query = this.db
            .collection('accounts')
            .where('phoneNumber', '==', phoneNumber)
            .limit(1);

        const matchingAccountDocs = await query.get();

        if (matchingAccountDocs.size <= 0) return undefined;
        const matchingAccountDoc = matchingAccountDocs.docs[0];
        return matchingAccountDoc.id;
    };

    getPublicGeneralInfo = async (
        uid: string
    ): Promise<IPublicGeneralInfo | undefined> => {
        const generalInfoDocRef = this.db
            .collection('accounts')
            .doc(uid)
            .collection('public')
            .doc('GeneralInfo');
        const generalInfoDoc = await generalInfoDocRef.get();

        if (generalInfoDoc.exists) {
            const generalInfoData = generalInfoDoc.data();
            if (generalInfoData) {
                return {
                    displayName: generalInfoData.displayName,
                    isComplete: generalInfoData.isComplete,
                } as IPublicGeneralInfo;
            }
        }
        return undefined;
    };

    setPublicGeneralInfo = async (
        uid: string,
        info: IPublicGeneralInfo
    ): Promise<void> => {
        const generalInfoDocRef = this.db
            .collection('accounts')
            .doc(uid)
            .collection('public')
            .doc('GeneralInfo');
        await generalInfoDocRef.set(info);
    };

    createDefaultProfile = async (uid: string): Promise<boolean> => {
        try {
            const defaultProfileDocRef = this.db
                .collection('accounts')
                .doc(uid)
                .collection('profiles')
                .doc('default');

            await defaultProfileDocRef.set({
                name: 'default',
            });

            return true;
        } catch (e) {
            return false;
        }
    };

    createProfile = async (uid: string, profile: IProfile): Promise<void> => {
        try {
            const profileDocRef = this.db
                .collection('accounts')
                .doc(uid)
                .collection('profiles')
                .doc(profile.id);

            await profileDocRef.set({ name: profile.name });
        } catch (e) {
            throw new SimpleShareError(ErrorCode.UNEXPECTED_DATABASE_ERROR, e as string);
        }
    };

    getAllProfiles = async (uid: string): Promise<IProfile[]> => {
        const profilesCollectionRef = this.db
            .collection('accounts')
            .doc(uid)
            .collection('profiles');
        const profileDocs = await profilesCollectionRef.get();

        const profiles: IProfile[] = profileDocs.docs.map((doc): IProfile => {
            const profileData = doc.data();
            return {
                id: doc.id,
                name: profileData.name,
            };
        });

        return profiles || [];
    };

    getProfile = async (
        uid: string,
        profileId: string
    ): Promise<IProfile | undefined> => {
        const defaultProfileDocRef = this.db
            .collection('accounts')
            .doc(uid)
            .collection('profiles')
            .doc(profileId);

        const profileDoc = await defaultProfileDocRef.get();
        const profileData = profileDoc.data();

        if (!profileData) return undefined;

        return {
            id: profileData.id,
            name: profileData.name,
        };
    };

    getProfileIdByName = async (
        uid: string,
        name: string
    ): Promise<string | undefined> => {
        const profilesCollectionRef = this.db
            .collection('accounts')
            .doc(uid)
            .collection('profiles');

        const query = profilesCollectionRef.where('name', '==', name).limit(1);

        const matchingProfileDocs = await query.get();

        if (matchingProfileDocs.size <= 0) return undefined;
        const matchingProfileDoc = matchingProfileDocs.docs[0];
        return matchingProfileDoc.id;
    };

    deleteProfile = async (
        uid: string,
        profileId: string
    ): Promise<boolean> => {
        try {
            const profileDocRef = this.db
                .collection('accounts')
                .doc(uid)
                .collection('profiles')
                .doc(profileId);

            await profileDocRef.delete();

            const sharesCollection = this.db
                .collection('shares')
                .doc(uid)
                .collection(profileId);

            const shareDocs = await sharesCollection.get();
            shareDocs.docs.forEach(async (doc) => {
                await this.deleteShareById(uid, profileId, doc.id);
            });

            return true;
        } catch (e) {
            return false;
        }
    };

    addProfileListener = async (uid: string): Promise<void> => {
        const profilesCollection = this.db
            .collection('accounts')
            .doc(uid)
            .collection('profiles');

        const unsubscribe = profilesCollection.onSnapshot((snapshot) => {
            const docChanges = snapshot.docChanges();
            docChanges.forEach((change) => {
                const profileId = change.doc.id;
                const profileData = change.doc.data();
                const profile: IProfile = {
                    id: profileId,
                    name: profileData.name,
                };

                switch (change.type) {
                    case 'added':
                        this.onProfileAddedCallback(profile);
                        break;
                    case 'modified':
                        this.onProfileModifiedCallback(profile);
                        break;
                    case 'removed':
                        this.onProfileDeletedCallback(profile);
                        break;
                }
            });
        });
        this.profileListeners.push({
            uid: uid,
            unsubscribe: unsubscribe,
        });
    };

    removeProfileListener = async (uid: string): Promise<void> => {
        const listener = this.profileListeners.find(
            (x) => x.uid === uid && x.uid === uid
        );
        listener?.unsubscribe();
        this.profileListeners = this.profileListeners.filter(
            (x) => x.uid !== uid && x.uid !== uid
        );
    };

    removeAllProfileListeners = async (): Promise<void> => {
        for (let listener; (listener = this.profileListeners.pop()); ) {
            listener.unsubscribe();
        }
    };

    hasProfileListener = (uid: string): boolean => {
        return (
            this.profileListeners.find((listener) => listener.uid === uid) !==
            undefined
        );
    };

    createShare = async (share: IShare): Promise<void> => {
        const shareDoc = this.db
            .collection('shares')
            .doc(share.toUid)
            .collection(share.toProfileId)
            .doc(share.id);
        await shareDoc.set(share);
    };

    deleteShareById = async (
        userId: string,
        profileId: string,
        shareId: string | undefined
    ): Promise<void> => {
        const shareDoc = this.db
            .collection('shares')
            .doc(userId)
            .collection(profileId)
            .doc(shareId);
        await shareDoc.delete();
    };

    deleteShare = async (share: IShare): Promise<boolean> => {
        try {
            await this.deleteShareById(
                share.toUid,
                share.toProfileId,
                share.id
            );
            return true;
        } catch (e) {
            return false;
        }
    };

    addShareListener = async (
        uid: string,
        profileId: string
    ): Promise<void> => {
        const profileSharesCollection = this.db
            .collection('shares')
            .doc(uid)
            .collection(profileId);

        const unsubscribe = profileSharesCollection.onSnapshot((snapshot) => {
            const docChanges = snapshot.docChanges();
            docChanges.forEach((change) => {
                const changedShareId = change.doc.id;
                const shareData = change.doc.data();
                const share: IShare = {
                    id: changedShareId,
                    type: shareData.type,
                    content: shareData.content,
                    fromUid: shareData.fromUid,
                    fromProfileId: shareData.fromProfileId,
                    toUid: shareData.toUid,
                    toProfileId: shareData.toProfileId,
                };
                switch (change.type) {
                    case 'added':
                        // Add share to redux state.
                        this.onShareAddedCallback(share);
                        break;
                    case 'modified':
                        // Update share in redux state.
                        this.onShareModifiedCallback(share);
                        break;
                    case 'removed':
                        // Remove share from redux state.
                        this.onShareDeletedCallback(share);
                        break;
                }
            });
        });
        this.shareListeners.push({
            uid: uid,
            profileId: profileId,
            unsubscribe: unsubscribe,
        });
    };

    removeShareListener = async (
        uid: string,
        profileId: string
    ): Promise<void> => {
        const listener = this.shareListeners.find(
            (x) => x.uid === uid && x.profileId === profileId
        );
        listener?.unsubscribe();
        this.shareListeners = this.shareListeners.filter(
            (x) => x.uid !== uid && x.profileId !== profileId
        );
    };

    removeAllShareListeners = async (): Promise<void> => {
        for (let listener; (listener = this.shareListeners.pop()); ) {
            listener.unsubscribe();
        }
    };

    hasShareListener = (uid: string, profileId: string): boolean => {
        return (
            this.shareListeners.find(
                (listener) =>
                    listener.uid === uid && listener.profileId === profileId
            ) !== undefined
        );
    };
}