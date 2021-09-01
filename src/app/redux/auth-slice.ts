import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { serviceHandler } from '..';
import { IUser } from '../../models';
import { SimpleShareError } from '../../SimpleShareError';

export interface AuthState {
    user: IUser | undefined;
    fetchedUser: boolean;
    signingIn: boolean;
    signInError?: SimpleShareError,
    signingOut: boolean;
    signedOut: boolean;
}

const initialState: AuthState = {
    user: undefined,
    signingIn: false,
    fetchedUser: false,
    signInError: undefined,
    signingOut: false,
    signedOut: false,
};

export const signInWithGoogle = createAsyncThunk('auth/signInWithGoogle', async (_, thunkAPI) => {
    const user: IUser = await serviceHandler.signInWithGoogle();
    return user;
});

export const signOut = createAsyncThunk('auth/signOut', async (_, thunkAPI) => {
    await serviceHandler.signOut();
});

export const startAuthStateListener = createAsyncThunk('auth/startAuthStateListener', async (_, thunkAPI) => {
    serviceHandler?.startAuthStateListener((user) => {
        thunkAPI.dispatch(setUser(user));
    });
})

export const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setUser: (state, action: PayloadAction<IUser | undefined>) => {
            state.user = action.payload;
            state.fetchedUser = true;
        }
    },
    extraReducers: (builder) => {
        builder.addCase(signInWithGoogle.pending, (state, action) => {
            state.signingIn = true;
            state.signInError = undefined;
        });
        builder.addCase(signInWithGoogle.fulfilled, (state, action) => {
            state.user = action.payload;
            state.signingIn = false;
        });
        builder.addCase(signInWithGoogle.rejected, (state, action) => {
            state.user = undefined;
            state.signingIn = false;
            state.signInError = action.error as SimpleShareError;
        });
        builder.addCase(signOut.pending, (state, action) => {
            state.signingOut = true;
            state.signedOut = false;
        });
        builder.addCase(signOut.fulfilled, (state, action) => {
            state.signingOut = false;
            state.signedOut = true;
        });
        builder.addCase(signOut.rejected, (state, action) => {
            state.signingOut = false;
            state.signedOut = false;
        });
        builder.addCase(startAuthStateListener.pending, (state, action) => {
        });
        builder.addCase(startAuthStateListener.fulfilled, (state, action) => {
        });
    }
});

export const { setUser} = authSlice.actions;
export default authSlice.reducer;
