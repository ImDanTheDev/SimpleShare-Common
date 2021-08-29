export default interface IStorageProvider {
    uploadProfilePicture: (
        uid: string,
        profileId: string,
        image: Blob | Uint8Array | ArrayBuffer
    ) => Promise<void>;

    getProfilePicture: (
        uid: string,
        profileId: string
    ) => Promise<string>;
}