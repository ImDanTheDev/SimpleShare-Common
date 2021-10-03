import { createAsyncThunk, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { AuthState, serviceHandler } from "..";
import { INotification } from "../../models/INotification";

export interface NotificationsState {
    notifications: INotification[];
}

const initialState: NotificationsState = {
    notifications: []
}

export const startNotificationListener = createAsyncThunk('notifications/startNotificationListener', async (_, thunkAPI) => {
    const uid = ((thunkAPI.getState() as any).auth as AuthState).user?.uid;
    if (!uid) return;
    
    serviceHandler.startNotificationListener(uid, async (noti: INotification) => {
        thunkAPI.dispatch(addNotification(noti));
    });
});

export const notificationsSlice = createSlice({
    name: 'notifications',
    initialState,
    reducers: {
        addNotification: (state, action: PayloadAction<INotification>) => {
            if (state.notifications.findIndex(x => x.share?.id === action.payload.share?.id) === -1) {
                state.notifications.push(action.payload);
            }
        },
        removeNotificationForShare: (state, action: PayloadAction<string>) => {
            state.notifications = state.notifications.filter(x => x.share?.id !== action.payload);
        },
        clearNotifications: (state) => {
            state.notifications = [];
        }
    },
});


export const {
    addNotification,
    removeNotificationForShare,
    clearNotifications
} = notificationsSlice.actions;
export default notificationsSlice.reducer;