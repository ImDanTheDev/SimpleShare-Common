import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { serviceHandler } from "..";
import { IProfile } from "../..";

export interface SearchState {
    profiles: IProfile[];
    searchingProfiles: boolean;
}

const initialState: SearchState = {
    profiles: [],
    searchingProfiles: false
}

export const searchProfiles = createAsyncThunk('search/searchProfiles', async (phoneNumber: string, thunkAPI) => {
    const profiles = await serviceHandler.searchProfiles(phoneNumber);
    return profiles;
});

export const searchSlice = createSlice({
    name: 'search',
    initialState,
    reducers: {
        clearProfiles: (state) => {
            state.profiles = [];
        }
    },
    extraReducers: (builder) => {
        builder.addCase(searchProfiles.pending, (state, action) => {
            state.searchingProfiles = true;
        });
        builder.addCase(searchProfiles.fulfilled, (state, action) => {
            state.profiles = action.payload;
            state.searchingProfiles = false;
        });
        builder.addCase(searchProfiles.rejected, (state, action) => {
            state.searchingProfiles = false;
        });
    }
});


export const {
    clearProfiles
} = searchSlice.actions;
export default searchSlice.reducer;