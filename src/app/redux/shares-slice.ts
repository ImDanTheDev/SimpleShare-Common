import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, serviceHandler } from '..';
import { IProfile, IPublicGeneralInfo, IShare } from '../../models';
import { ErrorCode, SimpleShareError } from '../../SimpleShareError';
import { addShareToOutbox } from './outbox-slice';
import { ProfilesState } from './profiles-slice';

export interface SharesState {
    shares: IShare[];
    currentShare: IShare | undefined;
    sendingShare: boolean;
    sentShare: boolean;
    sendShareError?: SimpleShareError;
}

const initialState: SharesState = {
    shares: [],
    currentShare: undefined,
    sendingShare: false,
    sentShare: false,
    sendShareError: undefined
};

export const sendShare = createAsyncThunk('shares/sendShare', async (sendData: {toPhoneNumber: string, toProfileName: string, share: {textContent?: string, fileSrc?: {blob: Blob, ext: string} | {filePath: string, fileType: string}}}, thunkAPI) => {
    const fromUid: string | undefined = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    const fromProfileId: string | undefined = ((thunkAPI.getState() as any).profiles as ProfilesState).currentProfileId;
    if (!fromUid || !fromProfileId) throw new SimpleShareError(ErrorCode.APP_ERROR, `The user's UID or profile ID is undefined`);

    const toUid: string | undefined = await serviceHandler.getUIDFromPhoneNumber(sendData.toPhoneNumber);
    if (!toUid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The recipient user does not exist.`);

    const toProfileId: string | undefined = await serviceHandler.getProfileIdByName(toUid, sendData.toProfileName);
    if (!toProfileId) throw new SimpleShareError(ErrorCode.APP_ERROR, `The recipient profile does not exist.`);

    let fileURL: string | undefined = undefined;

    if (sendData.share.fileSrc) {
        const isBlobSrc = (src: {blob: Blob, ext: string} | {filePath: string, fileType: string}): src is {blob: Blob, ext: string} => {
            return 'blob' in src && 'ext' in src;
        }

        if (isBlobSrc(sendData.share.fileSrc)) {
            fileURL = await serviceHandler.uploadFileBlob(fromUid, toUid, sendData.share.fileSrc as {blob: Blob, ext: string});
        } else {
            fileURL = await serviceHandler.uploadFilePath(fromUid, toUid, sendData.share.fileSrc as {filePath: string, fileType: string});
        }
    }

    const share: IShare = {
        fromUid: fromUid,
        fromProfileId: fromProfileId,
        toUid: toUid,
        toProfileId: toProfileId,
        textContent: sendData.share.textContent,
        fileURL: fileURL,
    }

    await serviceHandler.sendShare(share);
    await thunkAPI.dispatch(addShareToOutbox({
        ...share,
        toProfileName: sendData.toProfileName
    }));
});

export const deleteCloudShare = createAsyncThunk('shares/deleteCloudShare', async (share: IShare, thunkAPI) => {
    await serviceHandler.deleteShare(share);
    if (share.fileURL) {
        await serviceHandler.deleteFile(share.fileURL);
    }
});

export const startShareListener = createAsyncThunk('shares/startShareListener', async (profile: IProfile, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    await serviceHandler?.startShareListener(uid, profile, async (share) => {
        const currentProfileId = ((thunkAPI.getState() as any).profiles as ProfilesState).currentProfileId;
        if (share.toProfileId !== currentProfileId) {
            // The profile id of the received share does not match the current profile.
            // This share is likely from a previous request that is no longer needed.
            // TODO: Do not store ONLY the current profile's shares in state. Fetch
            // shares when a profile is selected, but do not clear shares of the previous
            // profile. Keep them in state to improve switching speed and minimize API calls.
            return;
        }
        // Dispatch the initial share then update with the fetched the names later.
        thunkAPI.dispatch(addShare(share));

        const nameData = await Promise.all([
            serviceHandler.getPublicGeneralInfo(share.fromUid),
            serviceHandler.getProfileNameById(share.fromUid, share.fromProfileId),
        ]);
        
        thunkAPI.dispatch(updateShare({
                ...share,
                fromDisplayName: nameData[0].displayName,
                fromProfileName: nameData[1]
        }));

    }, async (share) => {
        thunkAPI.dispatch(updateShare(share));
    }, async (share) => {
        thunkAPI.dispatch(deleteShare(share));
    });
});

export const sharesSlice = createSlice({
    name: 'shares',
    initialState,
    reducers: {
        addShare: (state, action: PayloadAction<IShare>) => {
            if (
                state.shares.findIndex((s) => s.id === action.payload.id) !== -1
            ) {
                return;
            }
            state.shares.push(action.payload);
        },
        deleteShare: (state, action: PayloadAction<IShare>) => {
            state.shares = state.shares.filter((x) => x.id !== action.payload.id);
        },
        updateShare: (state, action: PayloadAction<IShare>) => {
            const target = state.shares.find((x) => x.id === action.payload.id);
            if (!target) return;
            target.textContent = action.payload.textContent;
            target.fileURL = action.payload.fileURL;
            target.fromProfileId = action.payload.fromProfileId;
            target.fromUid = action.payload.fromUid;
            target.toProfileId = action.payload.toProfileId;
            target.toUid = action.payload.toUid;
            target.fromDisplayName = action.payload.fromDisplayName;
            target.fromProfileName = action.payload.fromProfileName;
        },
        setCurrentShare: (state, action: PayloadAction<IShare>) => {
            state.currentShare = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(sendShare.pending, (state, action) => {
            state.sendingShare = true;
            state.sentShare = false;
            state.sendShareError = undefined;
        });
        builder.addCase(sendShare.fulfilled, (state, action) => {
            state.sendingShare = false;
            state.sentShare = true;
            state.sendShareError = undefined;
        });
        builder.addCase(sendShare.rejected, (state, action) => {
            state.sendingShare = false;
            state.sentShare = false;
            state.sendShareError = action.error as SimpleShareError;
        });
        builder.addCase(deleteCloudShare.fulfilled, (state, action) => {});
        builder.addCase(startShareListener.pending, (state, action) => {
            state.shares = [];
        });
        builder.addCase(startShareListener.fulfilled, (state, action) => {});
    }
});

export const {
    addShare,
    deleteShare,
    updateShare,
    setCurrentShare,
} = sharesSlice.actions;
export default sharesSlice.reducer;
