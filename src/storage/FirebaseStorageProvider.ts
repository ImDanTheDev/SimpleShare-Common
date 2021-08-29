import { IStorage } from "@omnifire/api";
import IStorageProvider from "./IStorageProvider";

export default class FirebaseStorageProvider implements IStorageProvider {
    private readonly storage: IStorage;

    constructor(storage: IStorage) {
        this.storage = storage;
    }

    async uploadProfilePicture(uid: string, profileId: string, image: Blob | Uint8Array | ArrayBuffer): Promise<void> {
        const cloudRef = this.storage.ref(`users/${uid}/profiles/${profileId}/pfp.png`);
        const uploadTask = await cloudRef.put(image, {
            contentType: 'image/png'
        });
    }

    async getProfilePicture(uid: string, profileId: string): Promise<string> {
        const cloudRef = this.storage.ref(`users/${uid}/profiles/${profileId}/pfp.png`);
        const url = await cloudRef.getDownloadURL();
        return decodeURI(url);
    }

}