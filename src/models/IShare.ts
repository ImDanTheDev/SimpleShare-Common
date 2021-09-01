export default interface IShare {
    id?: string;
    type: string;
    content: string;
    fromUid: string;
    fromProfileId: string;
    toUid: string;
    toProfileId: string;
    fromDisplayName?: string;
    fromProfileName?: string;
    toDisplayName?: string;
    toProfileName?: string;
}
