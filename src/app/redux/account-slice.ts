import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { serviceHandler } from "..";
import { IAccountInfo, IPublicGeneralInfo, IUser } from "../../models";
import { SimpleShareError } from "../../SimpleShareError";
import { AuthState } from "./auth-slice";

export interface AccountInfoState {
    accountInfo: IAccountInfo | undefined;
    publicGeneralInfo: IPublicGeneralInfo | undefined;
    fetchedAccount: boolean;
    updatingAccount: boolean;
    updatedAccount: boolean;
    updateAccountError?: SimpleShareError;
}

const initialState: AccountInfoState = {
    accountInfo: undefined,
    publicGeneralInfo: undefined,
    fetchedAccount: false,
    updatedAccount: false,
    updatingAccount: false,
    updateAccountError: undefined,
};

export const updateAccount = createAsyncThunk('account/updateAccount', async (account: {accountInfo: IAccountInfo, publicGeneralInfo: IPublicGeneralInfo}, thunkAPI) => {
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
        });
        builder.addCase(updateAccount.fulfilled, (state, action) => {
            state.updatedAccount = true;
            state.updatingAccount = false;
        });
        builder.addCase(updateAccount.rejected, (state, action) => {
            state.updatedAccount = false;
            state.updatingAccount = false;
            state.updateAccountError = action.error as SimpleShareError;
        });
        builder.addCase(getAllAccountInfo.pending, (state, action) => {
            state.fetchedAccount = false;
        });
        builder.addCase(getAllAccountInfo.fulfilled, (state, action) => {
            state.accountInfo = action.payload.accountInfo;
            state.publicGeneralInfo = action.payload.publicGeneralInfo;
            state.fetchedAccount = true;
        });
    }
});

export const {
    setAccountInfo: setAccountInfo,
    setPublicGeneralInfo: setPublicGeneralInfo,
} = accountSlice.actions;
export default accountSlice.reducer;