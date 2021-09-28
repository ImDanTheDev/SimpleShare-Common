import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';
import { AccountInfoState, AuthState, LocalPersistState, serviceHandler, setLastSelectedProfile, updateAccount } from '..';
import { constants } from '../..';
import { IProfile, IPublicGeneralInfo } from '../../models';
import { ErrorCode, SimpleShareError } from '../../SimpleShareError';
import { startShareListener } from './shares-slice';

export interface ProfilesState {
    profiles: IProfile[];
    currentProfileId: string | undefined;
    editingProfiles: boolean;
    creatingProfile: boolean;
    createdProfile: boolean;
    createProfileError?: SimpleShareError;
    profileSelectedForEdit: IProfile | undefined;
    updatingProfile: boolean,
    updatedProfile: boolean,
    updateProfileError?: SimpleShareError,
}

const initialState: ProfilesState = {
    profiles: [],
    currentProfileId: 'default',
    editingProfiles: false,

    creatingProfile: false,
    createdProfile: false,
    createProfileError: undefined,

    profileSelectedForEdit: undefined,
    updatingProfile: false,
    updatedProfile: false,
    updateProfileError: undefined,
};

export const createProfile = createAsyncThunk('profiles/createProfile', async (profile: {profile: IProfile, pfpSrc?: Blob | {filePath: string, fileType: string}}, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    if (!uid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The current user's UID is undefined.`);

    let pfpURL: string | undefined = undefined;

    if (profile.pfpSrc) {
        // Upload profile picture
        pfpURL = await serviceHandler.uploadProfilePicture(uid, profile.pfpSrc);
    }

    const profileId = await serviceHandler.createProfile(uid, {
        ...profile.profile,
        // Use the PFP URL if one was created, otherwise use the provided PFP URL. If neither exists, use the default PFP ID.
        pfp: pfpURL || profile.profile.pfp || constants.DEFAULT_PFP_ID,
    });

    const publicGeneralInfo = ((thunkAPI.getState() as any).user as AccountInfoState).publicGeneralInfo;
    if (!publicGeneralInfo) return;

    const profiles = ((thunkAPI.getState() as any).profiles as ProfilesState).profiles;

    await serviceHandler.updateAccount(uid, {publicGeneralInfo: {
        ...publicGeneralInfo,
        profilePositions: [profileId, ...publicGeneralInfo.profilePositions || profiles.map(x => x.id)]
    } as IPublicGeneralInfo});
});

export const updateCloudProfile = createAsyncThunk('profiles/updateCloudProfile', async (updatedProfileData: {
    profile: IProfile,
    pfpSrc?: Blob | {filePath: string, fileType: string}
}, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    if (!uid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The current user's UID is undefined.`);

    // Carry over the old pfp incase a new one is not provided.
    let pfpURL: string | undefined = updatedProfileData.profile.pfp;

    if (updatedProfileData.pfpSrc) {
        // Upload profile picture
        pfpURL = await serviceHandler.uploadProfilePicture(uid, updatedProfileData.pfpSrc);
    }

    await serviceHandler.updateProfile(uid, {
        ...updatedProfileData.profile,
        pfp: pfpURL || updatedProfileData.profile.pfp || constants.DEFAULT_PFP_ID
    });
});

export const deleteCloudProfile = createAsyncThunk('profiles/deleteCloudProfile', async (profile: IProfile, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    if (!uid) throw new SimpleShareError(ErrorCode.APP_ERROR, `The current user's UID is undefined.`);
    
    const publicGeneralInfo = (((thunkAPI.getState() as any).user) as AccountInfoState).publicGeneralInfo;
    if (!publicGeneralInfo) {
        throw new SimpleShareError(ErrorCode.APP_ERROR, `The user's public general info is undefined.`);
    }

    const defaultProfileId = publicGeneralInfo.defaultProfileId;
    const profiles = (((thunkAPI.getState() as any).profiles) as ProfilesState).profiles;
    if (profile.id === defaultProfileId) {
        // Attempting to delete default profile. Change default profile to next non-default profile.
        const firstNonDefaultProfileIndex = profiles.findIndex(x => x.id && x.id !== defaultProfileId);
        if (firstNonDefaultProfileIndex === -1) {
            // No non-default profiles exist.
            throw new SimpleShareError(ErrorCode.PROFILE_DOES_NOT_EXIST, 'A non-default profile does not exist.');
        } else {
            // Found a non-default profile.
            const profileToMakeDefault = profiles[firstNonDefaultProfileIndex];
            await thunkAPI.dispatch(updateAccount({
                publicGeneralInfo: {
                    ...publicGeneralInfo,
                    defaultProfileId: profileToMakeDefault.id,
                } as IPublicGeneralInfo
            }))
        }
    }

    if (profile.pfp) await serviceHandler.deleteProfilePicture(profile.pfp);
    await serviceHandler.deleteProfile(uid, profile);

    await serviceHandler.updateAccount(uid, {publicGeneralInfo: {
        ...publicGeneralInfo,
        profilePositions: profiles.filter(x => x.id !== profile.id).map(x => x.id)
    } as IPublicGeneralInfo});
});

export const startProfileListener = createAsyncThunk('profiles/startProfileListener', async (_, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    await serviceHandler?.startProfileListener(uid, (profile) => {
        thunkAPI.dispatch(addProfile(profile));

        const profilesState: ProfilesState = ((thunkAPI.getState() as any).profiles) as ProfilesState;
        const profileCount = profilesState.profiles.length;

        const lastSelectedProfile = ((thunkAPI.getState() as any).localPersist as LocalPersistState).lastSelectedProfile;

        if (profileCount === 1 || lastSelectedProfile === profile.id) {
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
    thunkAPI.dispatch(setLastSelectedProfile(profile.id));
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
        selectProfileForEditing: (state, action: PayloadAction<IProfile | undefined>) => {
            state.profileSelectedForEdit = action.payload;
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
        builder.addCase(updateCloudProfile.pending, (state, action) => {
            state.updatingProfile = true;
            state.updatedProfile = false;
            state.updateProfileError = undefined;
        });
        builder.addCase(updateCloudProfile.fulfilled, (state, action) => {
            state.updatingProfile = false;
            state.updatedProfile = true;
            state.updateProfileError = undefined;
        });
        builder.addCase(updateCloudProfile.rejected, (state, action) => {
            state.updatingProfile = false;
            state.updatedProfile = false;
            state.updateProfileError = (action.error as SimpleShareError);
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
    selectProfileForEditing
} = profilesSlice.actions;
export default profilesSlice.reducer;
