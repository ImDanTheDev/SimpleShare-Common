import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { serviceHandler } from '..';
import { IPublicGeneralInfo, IShare } from '../../models';

export interface OutboxEntry {
    share: IShare,
    pfpURL: string
}

export interface OutboxState {
    shares: OutboxEntry[];
}

const initialState: OutboxState = {
    shares: [],
};

export const addShareToOutbox = createAsyncThunk('outbox/addShareToOutbox', async (share: IShare, thunkAPI) => {
    const toPublicGeneralInfo: IPublicGeneralInfo = await serviceHandler.getPublicGeneralInfo(share.toUid);
    const pfpURL: string = await serviceHandler.getProfilePicture(share.toUid, share.toProfileId);
    return {
        share: {
            ...share,
            toDisplayName: toPublicGeneralInfo.displayName
        },
        pfpURL: pfpURL
    } as OutboxEntry
});

export const outboxSlice = createSlice({
    name: 'outbox',
    initialState,
    reducers: {
        clearOutbox: (state) => {
            state.shares = [];
        },
    },
    extraReducers: (builder) => {
        builder.addCase(addShareToOutbox.pending, (state, action) => {});
        builder.addCase(addShareToOutbox.fulfilled, (state, action) => {
            state.shares.push(action.payload);
        });
    }
});

export const { clearOutbox: clearOutbox } = outboxSlice.actions;
export default outboxSlice.reducer;
