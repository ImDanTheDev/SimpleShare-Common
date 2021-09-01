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

export const sendShare = createAsyncThunk('shares/sendShare', async (sendData: {toPhoneNumber: string, toProfileName: string, share: {content: string, type: string}}, thunkAPI) => {
    const fromUid: string | undefined = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    const fromProfileId: string | undefined = ((thunkAPI.getState() as any).profiles as ProfilesState).currentProfileId;
    if (!fromUid || !fromProfileId) throw new SimpleShareError(ErrorCode.APP_ERROR, `The user's UID or profile ID is undefined`);

    const toUid: string | undefined = await serviceHandler.getUIDFromPhoneNumber(sendData.toPhoneNumber);
    if (!toUid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The recipient user does not exist.`);

    const toProfileId: string | undefined = await serviceHandler.getProfileIdByName(toUid, sendData.toProfileName);
    if (!toProfileId) throw new SimpleShareError(ErrorCode.APP_ERROR, `The recipient profile does not exist.`);

    const share: IShare = {
        fromUid: fromUid,
        fromProfileId: fromProfileId,
        toUid: toUid,
        toProfileId: toProfileId,
        content: sendData.share.content,
        type: sendData.share.type
    }

    await serviceHandler.sendShare(share);

    const toPublicGeneralInfo: IPublicGeneralInfo = await serviceHandler.getPublicGeneralInfo(toUid);
    thunkAPI.dispatch(addShareToOutbox({
        ...share,
        toProfileName: sendData.toProfileName,
        toDisplayName: toPublicGeneralInfo.displayName
    }));
});

export const deleteCloudShare = createAsyncThunk('shares/deleteCloudShare', async (share: IShare, thunkAPI) => {
    await serviceHandler.deleteShare(share);
});

export const startShareListener = createAsyncThunk('shares/startShareListener', async (profile: IProfile, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    await serviceHandler?.startShareListener(uid, profile, async (share) => {
        const toPublicGeneralInfo: IPublicGeneralInfo = await serviceHandler.getPublicGeneralInfo(share.toUid);
        const toProfileName = await serviceHandler.getProfileNameById(share.toUid, share.toProfileId);
        thunkAPI.dispatch(addShare({
            ...share,
            fromDisplayName: toPublicGeneralInfo.displayName,
            fromProfileName: toProfileName
        }));
    }, (share) => {
        thunkAPI.dispatch(updateShare(share));
    }, (share) => {
        thunkAPI.dispatch(deleteShare(share));
    });
});

export const sharesSlice = createSlice({
    name: 'shares',
    initialState,
    reducers: {
        setShares: (state, action: PayloadAction<IShare[]>) => {
            state.shares = action.payload;
        },
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
            target.content = action.payload.content;
            target.type = action.payload.type;
            target.fromProfileId = action.payload.fromProfileId;
            target.fromUid = action.payload.fromUid;
            target.toProfileId = action.payload.toProfileId;
            target.toUid = action.payload.toUid;
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
    setShares,
    addShare,
    deleteShare,
    updateShare,
    setCurrentShare,
} = sharesSlice.actions;
export default sharesSlice.reducer;
