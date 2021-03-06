import { createAsyncThunk, createSlice, isAsyncThunkAction, PayloadAction } from "@reduxjs/toolkit";
import { ProfilesState, serviceHandler, setProfiles } from "..";
import { IAccountInfo, IPublicGeneralInfo, IUser } from "../../models";
import { SimpleShareError } from "../../SimpleShareError";
import { AuthState } from "./auth-slice";

export interface AccountInfoState {
    accountInfo: IAccountInfo | undefined;
    publicGeneralInfo: IPublicGeneralInfo | undefined;
    fetchedAccount: boolean;
    fetchAccountError?: SimpleShareError;
    updatingAccount: boolean;
    updatedAccount: boolean;
    updateAccountError?: SimpleShareError;
}

const initialState: AccountInfoState = {
    accountInfo: undefined,
    publicGeneralInfo: undefined,
    fetchedAccount: false,
    fetchAccountError: undefined,
    updatedAccount: false,
    updatingAccount: false,
    updateAccountError: undefined,
};

export const updateAccount = createAsyncThunk('account/updateAccount', async (account: {accountInfo?: IAccountInfo, publicGeneralInfo?: IPublicGeneralInfo}, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    await serviceHandler.updateAccount(uid, account);
    await thunkAPI.dispatch(getAllAccountInfo());
});

export const getAllAccountInfo = createAsyncThunk('account/getAllAccountInfo', async (_, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    const accountInfo = await serviceHandler.getAccountInfo(uid);
    const publicGeneralInfo = await serviceHandler.getPublicGeneralInfo(uid);
    return {
        accountInfo,
        publicGeneralInfo
    }
});

export const startPublicGeneralInfoListener = createAsyncThunk('account/startPublicGeneralInfoListener', async (_, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;

    await serviceHandler.startPublicGeneralInfoListener(uid, async (publicGeneralInfo) => {
        thunkAPI.dispatch(setPublicGeneralInfo(publicGeneralInfo));

        const profiles = ((thunkAPI.getState() as any).profiles as ProfilesState).profiles;

        thunkAPI.dispatch(setProfiles([...profiles].sort((a, b) => {
            return (
                publicGeneralInfo.profilePositions.indexOf(
                    a.id || ''
                ) -
                publicGeneralInfo.profilePositions.indexOf(
                    b.id || ''
                )
            );
        })));
    });
});

export const accountSlice = createSlice({
    name: 'account',
    initialState,
    reducers: {
        setAccountInfo: (
            state,
            action: PayloadAction<IAccountInfo | undefined>
        ) => {
            state.accountInfo = action.payload;
        },
        setPublicGeneralInfo: (
            state,
            action: PayloadAction<IPublicGeneralInfo | undefined>
        ) => {
            state.publicGeneralInfo = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(updateAccount.pending, (state, action) => {
            state.updatedAccount = false;
            state.updatingAccount = true;
            state.updateAccountError = undefined;
        });
        builder.addCase(updateAccount.fulfilled, (state, action) => {
            state.updatedAccount = true;
            state.updatingAccount = false;
            state.updateAccountError = undefined;
        });
        builder.addCase(updateAccount.rejected, (state, action) => {
            state.updatedAccount = false;
            state.updatingAccount = false;
            state.updateAccountError = action.error as SimpleShareError;
        });
        builder.addCase(getAllAccountInfo.pending, (state, action) => {
            state.fetchedAccount = false;
            state.fetchAccountError = undefined;
        });
        builder.addCase(getAllAccountInfo.fulfilled, (state, action) => {
            state.accountInfo = action.payload.accountInfo;
            state.publicGeneralInfo = action.payload.publicGeneralInfo;
            state.fetchedAccount = true;
            state.fetchAccountError = undefined;
        });
        builder.addCase(getAllAccountInfo.rejected, (state, action) => {
            state.accountInfo = undefined;
            state.publicGeneralInfo = undefined;
            state.fetchedAccount = false;
            state.fetchAccountError = action.error as SimpleShareError;
        });
    }
});

export const {
    setAccountInfo: setAccountInfo,
    setPublicGeneralInfo: setPublicGeneralInfo,
} = accountSlice.actions;
export default accountSlice.reducer;