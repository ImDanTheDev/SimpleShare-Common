import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AuthState, serviceHandler } from '..';
import { constants } from '../..';
import { IProfile } from '../../models';
import { ErrorCode, SimpleShareError } from '../../SimpleShareError';
import { startShareListener } from './shares-slice';

export interface ProfilesState {
    profiles: IProfile[];
    currentProfileId: string | undefined;
    editingProfiles: boolean;
    creatingProfile: boolean;
    createdProfile: boolean;
    createProfileError?: SimpleShareError;
}

const initialState: ProfilesState = {
    profiles: [],
    currentProfileId: undefined,
    editingProfiles: false,
    creatingProfile: false,
    createdProfile: false,
    createProfileError: undefined
};

export const createProfile = createAsyncThunk('profiles/createProfile', async (profile: {profile: IProfile, pfpSrc?: Blob | {filePath: string, fileType: string}}, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    if (!uid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The current user's UID is undefined.`);

    let pfpURL: string | undefined = undefined;

    if (profile.pfpSrc) {
        // Upload profile picture
        pfpURL = await serviceHandler.uploadProfilePicture(uid, profile.pfpSrc);
    }

    await serviceHandler.createProfile(uid, {
        ...profile.profile,
        // Use the PFP URL if one was created, otherwise use the provided PFP URL. If neither exists, use the default PFP ID.
        pfp: pfpURL || profile.profile.pfp || constants.DEFAULT_PFP_ID
    });
});

export const deleteCloudProfile = createAsyncThunk('profiles/deleteCloudProfile', async (profile: IProfile, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    if (!uid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The current user's UID is undefined.`);
    
    if (profile.pfp) await serviceHandler.deleteProfilePicture(profile.pfp);
    await serviceHandler.deleteProfile(uid, profile);
});

export const startProfileListener = createAsyncThunk('profiles/startProfileListener', async (_, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    await serviceHandler?.startProfileListener(uid, (profile) => {
        thunkAPI.dispatch(addProfile(profile));

        const profilesState: ProfilesState = ((thunkAPI.getState() as any).profiles) as ProfilesState;
        const profileCount = profilesState.profiles.length;

        if (profileCount === 1) {
            thunkAPI.dispatch(switchProfile(profile));
        }
    }, (profile) => {
        thunkAPI.dispatch(updateProfile(profile));
    }, (profile) => {
        thunkAPI.dispatch(deleteProfile(profile));

        const profilesState: ProfilesState = ((thunkAPI.getState() as any).profiles) as ProfilesState;
        const profileCount = profilesState.profiles.length;

        const wasCurrentProfile = profilesState.currentProfileId === profile.id;

        if (wasCurrentProfile && profileCount > 0) {
            // The current profile was just deleted. Try switching to a different one.
            thunkAPI.dispatch(switchProfile(profilesState.profiles[0]));
        }
    });
});

export const switchProfile = createAsyncThunk('profiles/switchProfile', async (profile: IProfile, thunkAPI) => {
    await thunkAPI.dispatch(startShareListener(profile));
    return profile;
});

export const profilesSlice = createSlice({
    name: 'profiles',
    initialState,
    reducers: {
        addProfile: (state, action: PayloadAction<IProfile>) => {
            if (
                state.profiles.findIndex((p) => p.id === action.payload.id) !==
                -1
            ) {
                // Profile already exists in state.
                return;
            }
            
            state.profiles.push(action.payload);
        },
        deleteProfile: (state, action: PayloadAction<IProfile>) => {
            state.profiles = state.profiles.filter(
                (profile) => profile.id !== action.payload.id
            );
        },
        updateProfile: (state, action: PayloadAction<IProfile>) => {
            const target = state.profiles.find(
                (x) => x.id === action.payload.id
            );
            if (!target) return;
            target.name = action.payload.name;
            target.pfp = action.payload.pfp;
        },
        setProfiles: (state, action: PayloadAction<IProfile[]>) => {
            state.profiles = action.payload;
        },
        setCurrentProfile: (state, action: PayloadAction<string>) => {
            state.currentProfileId = action.payload;
        },
        setEditingProfiles: (state, action: PayloadAction<boolean>) => {
            state.editingProfiles = action.payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(createProfile.pending, (state, action) => {
            state.creatingProfile = true;
            state.createdProfile = false;
            state.createProfileError = undefined;
        });
        builder.addCase(createProfile.fulfilled, (state, action) => {
            state.creatingProfile = false;
            state.createdProfile = true;
            state.createProfileError = undefined;
        });
        builder.addCase(createProfile.rejected, (state, action) => {
            state.creatingProfile = false;
            state.createdProfile = false;
            state.createProfileError = (action.error as SimpleShareError);
        });
        builder.addCase(deleteCloudProfile.fulfilled, (state, action) => {});
        builder.addCase(startProfileListener.fulfilled, (state, action) => {});
        builder.addCase(switchProfile.fulfilled, (state, action) => {
            state.currentProfileId = action.payload.id;
        });
    }
});

export const {
    addProfile,
    deleteProfile,
    updateProfile,
    setProfiles,
    setCurrentProfile,
    setEditingProfiles,
} = profilesSlice.actions;
export default profilesSlice.reducer;
