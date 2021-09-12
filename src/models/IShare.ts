export default interface IShare {
    id?: string;
    textContent?: string;
    fileURL?: string;
    fromUid: string;
    fromProfileId: string;
    toUid: string;
    toProfileId: string;
    fromDisplayName?: string;
    fromProfileName?: string;
    toDisplayName?: string;
    toProfileName?: string;
}
