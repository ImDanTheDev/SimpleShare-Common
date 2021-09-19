import { IAuth, IFirebase, IFirestore, IReference, IStorage, OFUploadMetadata } from "@omnifire/api";
import { updateShare } from ".";
import { constants } from "..";
import { IAccountInfo, IProfile, IPublicGeneralInfo, IShare } from "../models";
import IUser from "../models/IUser";
import { ErrorCode, SimpleShareError } from "../SimpleShareError";
import IServiceHandler from "./IServiceHandler";
import { v4 as uuid} from 'uuid';

interface IShareListener {
    uid: string;
    profileId: string;
    unsubscribe: () => void;
}

interface IProfileListener {
    uid: string;
    unsubscribe: () => void;
}

const supportedAppInfo = {
    appInfoSchemaVersion: 1,
    authVersion: 1,
    firestoreSchemaVersion: 1,
    hostingVersion: 1,
    storageVersion: 1
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

        this.firestore.settings({
            ignoreUndefinedProperties: true
        })
    }

    async isServiceHandlerUpToDate(): Promise<boolean> {
        const appInfo = await this.firestore.collection('appInfo').doc('appInfo').get();
        const appInfoData = appInfo.data();

        if (!appInfoData) throw new SimpleShareError(ErrorCode.APP_ERROR);

        if (appInfoData.appInfoSchemaVersion !== supportedAppInfo.appInfoSchemaVersion
            || appInfoData.authVersion !== supportedAppInfo.authVersion
            || appInfoData.firestoreSchemaVersion !== supportedAppInfo.firestoreSchemaVersion
            || appInfoData.hostingVersion !== supportedAppInfo.hostingVersion
            || appInfoData.storageVersion !== supportedAppInfo.storageVersion) {
                // This version of SimpleShare Common is no longer supported. The host
                // application must update to a newer version of the library.
                return false;
        }

        return true;
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
                throw new SimpleShareError(ErrorCode.SIGN_IN_USER_NOT_FOUND);
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
                    case 'auth/popup-blocked':
                        throw new SimpleShareError(ErrorCode.SIGN_IN_BLOCKED);
                    case 'auth/cancelled-popup-request':
                        throw new SimpleShareError(ErrorCode.SIGN_IN_POPUP_ALREADY_OPENED);
                    case 'auth/user-token-expired':
                        throw new SimpleShareError(ErrorCode.SIGN_IN_EXPIRED_TOKEN);
                    case 'auth/unverified-email':
                        throw new SimpleShareError(ErrorCode.SIGN_IN_EMAIL_UNVERIFIED);
                    case 'auth/user-disabled':
                        throw new SimpleShareError(ErrorCode.SIGN_IN_ACCOUNT_DISABLED);
                }
            }
            if (e.message === 'NETWORK_ERROR') { // RNFirebase Error
                throw new SimpleShareError(ErrorCode.NO_NETWORK_CONNECTION);
            }
            throw new SimpleShareError(ErrorCode.SIGN_IN_UNEXPECTED_ERROR, JSON.stringify(e));
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
            name: profile.name,
            pfp: profile.pfp,
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
                    pfp: profileData.pfp,
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
            docChanges.forEach(async (change) => {
                const changedShareId = change.doc.id;
                const shareData = change.doc.data();
                const share: IShare = {
                    id: changedShareId,
                    textContent: shareData.textContent || shareData.content, // TODO: Remove .content
                    fileURL: shareData.fileURL,
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

    async getAccountInfo(uid: string | undefined): Promise<IAccountInfo | undefined> {
        const accountDocRef = this.firestore.collection('accounts').doc(uid);
        const accountDoc = await accountDocRef.get();

        if (accountDoc.exists) {
            const accountDocData = accountDoc.data();
            if (accountDocData) {
                return {
                    isAccountComplete: accountDocData.isAccountComplete,
                    phoneNumber: accountDocData.phoneNumber
                };
            } else {
                throw new SimpleShareError(ErrorCode.UNEXPECTED_DATABASE_ERROR, 'Account Info was found but does not contain any data.');
            }
        } else {
            return undefined;
        }
    }

    async getPublicGeneralInfo(uid: string | undefined): Promise<IPublicGeneralInfo | undefined> {
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
            } else {
                throw new SimpleShareError(ErrorCode.UNEXPECTED_DATABASE_ERROR, 'Public General Info was found but does not contain any data.');
            }
        } else {
            return undefined;
        }
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

    async uploadProfilePicture(uid: string, pfp: Blob | {filePath: string, fileType: string}): Promise<string> {
        const fileName: string = uuid();

        const isBlob = pfp instanceof Blob;
        const fileType = isBlob ? pfp.type : pfp.fileType;
        const fileExtension = fileType.slice(fileType.lastIndexOf('/') + 1);
        const pfpFileRef = this.storage.ref(`users/${uid}/pfps/${fileName}.${fileExtension}`);
        const uploadTaskSnap = isBlob ? pfpFileRef.put(pfp, {contentType: pfp.type}) : pfpFileRef.putFile(pfp.filePath, {contentType: pfp.fileType});

        await new Promise<void>((resolve, reject) => {
            uploadTaskSnap.then(async () => {
                resolve();
            }).catch((e: any) => {
                reject(e);
            })
        });

        return await pfpFileRef?.getDownloadURL() as string;
    }

    async deleteProfilePicture(pfpURL: string): Promise<void> {
        if (pfpURL === constants.DEFAULT_PFP_ID) return;
        await this.deleteFile(pfpURL);
    }

    async deleteFile(fileURL: string): Promise<void> {
        const fileRef = this.storage.refFromURL(fileURL);
        await fileRef.delete();
    }

    async getProfilePicture(uid: string, profileId: string): Promise<string> {
        const profileDocRef = this.firestore.collection('accounts').doc(uid).collection('profiles').doc(profileId);
        const profileDoc = await profileDocRef.get();

        if (profileDoc.exists) {
            const profileData = profileDoc.data();
            if (profileData) {
                return profileData.pfp || constants.DEFAULT_PFP_ID;
            }
        }

        return constants.DEFAULT_PFP_ID;
    }

    async uploadFilePath(ownerUID: string,  recipientUID: string, pathSrc: {filePath: string, fileType: string}): Promise<string> {
        const fileName: string = uuid();
        const fileExtension = pathSrc.filePath.slice(pathSrc.filePath.lastIndexOf('.') + 1);
        const fileRef = this.storage.ref(`files/${fileName}.${fileExtension}`)
        const metadata: OFUploadMetadata = {
            contentType: pathSrc.fileType,
            customMetadata: {
                owner: ownerUID,
                recipient: recipientUID
            }
        };

        const uploadTaskSnap = fileRef.putFile(pathSrc.filePath, metadata);

        await new Promise<void>((resolve, reject) => {
            uploadTaskSnap.then(async () => {
                resolve();
            }).catch((e: any) => {
                reject(e);
            })
        });

        return await fileRef?.getDownloadURL() as string;
    }

    async uploadFileBlob(ownerUID: string, recipientUID: string, blobSrc: {blob: Blob, ext: string}): Promise<string> {
        const fileName: string = uuid();
        const fileExtension = blobSrc.ext;
        const fileRef = this.storage.ref(`files/${fileName}.${fileExtension}`);

        const metadata: OFUploadMetadata = {
            contentType: blobSrc.blob.type,
            contentDisposition: 'attachment',
            customMetadata: {
                owner: ownerUID,
                recipient: recipientUID,
            }
        };

        const uploadTaskSnap = fileRef.put(blobSrc.blob, metadata);

        await new Promise<void>((resolve, reject) => {
            uploadTaskSnap.then(async () => {
                resolve();
            }).catch((e: any) => {
                reject(e);
            })
        });

        return await fileRef?.getDownloadURL() as string;
    }
}