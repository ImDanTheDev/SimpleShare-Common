import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface LocalPersistState {
    lastSelectedProfile?: string
}

const initialState: LocalPersistState = {
    lastSelectedProfile: undefined
};

export const localPersistSlice = createSlice({
    name: 'localPersist',
    initialState,
    reducers: {
        setLastSelectedProfile: (state, action: PayloadAction<string | undefined>) => {
            state.lastSelectedProfile = action.payload;
        }
    },
});

export const {
    setLastSelectedProfile
} = localPersistSlice.actions;
export default localPersistSlice.reducer;