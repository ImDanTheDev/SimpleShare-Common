import { IAuth, IFirebase, IFirestore, IStorage } from "@omnifire/api";
import { updateShare } from ".";
import { IAccountInfo, IProfile, IPublicGeneralInfo, IShare } from "../models";
import IUser from "../models/IUser";
import { ErrorCode, SimpleShareError } from "../SimpleShareError";
import IServiceHandler from "./IServiceHandler";

interface IShareListener {
    uid: string;
    profileId: string;
    unsubscribe: () => void;
}

interface IProfileListener {
    uid: string;
    unsubscribe: () => void;
}

export default class FirebaseServiceHandler implements IServiceHandler {

    private readonly firebase: IFirebase;
    private readonly firestore: IFirestore;
    private readonly auth: IAuth;
    private readonly storage: IStorage;

    private shareListeners: IShareListener[] = [];
    private profileListeners: IProfileListener[] = [];

    constructor(firebase: IFirebase, firestore: IFirestore, auth: IAuth, storage: IStorage) {
        this.firebase = firebase;
        this.firestore = firestore;
        this.auth = auth;
        this.storage = storage;
    }

    startAuthStateListener(listener: (user?: IUser) => void): void {
        this.auth.onAuthStateChanged((user) => {
            if (user) {
                listener({
                    uid: user.uid,
                    displayName: user.displayName || ''
                });
            } else {
                listener(undefined)
            }
        });
    }

    async signInWithGoogle(): Promise<IUser> {
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
        } catch (e: any) {
            if (e.code) {
                switch (e.code) {
                    case 'auth/popup-closed-by-user':
                        throw new SimpleShareError(ErrorCode.SIGN_IN_CANCELLED);
                }
            }
            throw new SimpleShareError(ErrorCode.UNEXPECTED_SIGN_IN_ERROR);
        }
    }

    async signOut(): Promise<void> {
        await this.auth.signOut();
    }

    async updateAccount(uid: string | undefined, account: {accountInfo: IAccountInfo, publicGeneralInfo: IPublicGeneralInfo}): Promise<void> {
        try {
            const accountDocRef = this.firestore.collection('accounts').doc(uid);
            await accountDocRef.set(account.accountInfo);
            
            const generalInfoDocRef = this.firestore.collection('accounts').doc(uid).collection('public').doc('GeneralInfo');
            await generalInfoDocRef.set(account.publicGeneralInfo);
        } catch (e) {
            throw new SimpleShareError(ErrorCode.UNEXPECTED_DATABASE_ERROR, (e as any));
        }
    }

    async sendShare(share: IShare): Promise<void> {
        const shareDoc = this.firestore.collection('shares').doc(share.toUid).collection(share.toProfileId).doc(share.id);
        await shareDoc.set(share);
    }

    async deleteShare(share: IShare): Promise<void> {
        const shareDoc = this.firestore.collection('shares').doc(share.toUid).collection(share.toProfileId).doc(share.id);
        await shareDoc.delete();
    }

    async createProfile(uid: string | undefined, profile: IProfile): Promise<void> {
        const profileDocRef = this.firestore.collection('accounts').doc(uid).collection('profiles').doc(profile.id);
        await profileDocRef.set({
            name: profile.name
        });
    }

    async deleteProfile(uid: string | undefined, profile: IProfile): Promise<void> {
        if (!profile.id) return;

        const profileDocRef = this.firestore.collection('accounts').doc(uid).collection('profiles').doc(profile.id);
        await profileDocRef.delete();

        const sharesCollection = this.firestore.collection('shares').doc(uid).collection(profile.id);

        const shareDocs = await sharesCollection.get();
        shareDocs.forEach(async (docSnapshot) => {
            await docSnapshot.ref.delete();
        });
    }

    async startProfileListener(
        uid: string | undefined,
        addListener: (profile: IProfile) => void,
        updateListener: (profile: IProfile) => void,
        deleteListener: (profile: IProfile) => void): Promise<void> {
        if (!uid) return;
        const profilesCollection = this.firestore.collection('accounts').doc(uid).collection('profiles');
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
                        addListener(profile);
                        break;
                    case 'modified':
                        updateListener(profile);
                        break;
                    case 'removed':
                        deleteListener(profile);
                        break;
                }
            });
        });

        // Unsubscribe and remove current profile listeners.
        if (this.profileListeners.length > 0) {
            for(let listener; (listener = this.profileListeners.pop());) {
                listener.unsubscribe();
            }
        }

        // Add the new profile listener.
        this.profileListeners.push({
            uid: uid,
            unsubscribe: unsubscribe
        });
    }

    async startShareListener(
        uid: string | undefined,
        profile: IProfile,
        addListener: (share: IShare) => Promise<void>,
        updateListener: (share: IShare) => Promise<void>,
        deleteListener: (share: IShare) => Promise<void>): Promise<void> {
        if (!uid || !profile.id) return;
        const profileSharesCollection = this.firestore.collection('shares').doc(uid).collection(profile.id);

        const unsubscribe = profileSharesCollection.onSnapshot(async (snapshot) => {
            const docChanges = snapshot.docChanges();
            const changeCallbacks: Promise<void>[] = [];
            const start1 = performance.now();
            docChanges.forEach(async (change) => {
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
                        changeCallbacks.push(addListener(share));
                        break;
                    case 'modified':
                        changeCallbacks.push(updateListener(share));
                        break;
                    case 'removed':
                        changeCallbacks.push(deleteListener(share));
                        break;
                }
            });
            await Promise.all(changeCallbacks);
        });

        // Unsubscribe and remove current share listeners.
        if (this.shareListeners.length > 0) {
            for(let listener; (listener = this.shareListeners.pop());) {
                listener.unsubscribe();
            }
        }

        // Add the new share listener.
        this.shareListeners.push({
            uid: uid,
            profileId: profile.id,
            unsubscribe: unsubscribe
        });
    }

    async getAccountInfo(uid: string | undefined): Promise<IAccountInfo> {
        const accountDocRef = this.firestore.collection('accounts').doc(uid);
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
        throw new SimpleShareError(ErrorCode.UNEXPECTED_DATABASE_ERROR, 'Account Info does not exist or data could not be found.');
    }

    async getPublicGeneralInfo(uid: string | undefined): Promise<IPublicGeneralInfo> {
        const generalInfoDocRef = this.firestore
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
        throw new SimpleShareError(ErrorCode.UNEXPECTED_DATABASE_ERROR, 'Public General Info does not exist or data could not be found.');
    };

    async getUIDFromPhoneNumber(phoneNumber: string): Promise<string | undefined> {
        const query = this.firestore.collection('accounts').where('phoneNumber', '==', phoneNumber).limit(1);
        const matchingAccountDocs = await query.get();

        if (matchingAccountDocs.size <= 0) return undefined;
        const matchingAccountDoc = matchingAccountDocs.docs[0];
        return matchingAccountDoc.id;
    }

    async getProfileIdByName(uid: string, profileName: string): Promise<string | undefined> {
        const profilesCollectionRef = this.firestore.collection('accounts').doc(uid).collection('profiles');
        const query = profilesCollectionRef.where('name', '==', profileName).limit(1);

        const matchingProfileDocs = await query.get();

        if (matchingProfileDocs.size <= 0) return undefined;
        const matchingProfileDoc = matchingProfileDocs.docs[0];
        return matchingProfileDoc.id;
    }

    async getProfileNameById(uid: string, profileId: string): Promise<string | undefined> {
        const profileDocRef = this.firestore.collection('accounts').doc(uid).collection('profiles').doc(profileId);
        const profileDoc = await profileDocRef.get();

        if (profileDoc.exists) {
            const profileData = profileDoc.data();
            if (profileData) {
                return profileData.name
            }
        }
        return undefined;
    }
}