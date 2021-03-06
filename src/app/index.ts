import { IAuth, IFirebase, IFirestore, IStorage } from "@omnifire/api"
import FirebaseServiceHandler from "./FirebaseServiceHandler";
import IServiceHandler from "./IServiceHandler";
import accountReducer, {
    AccountInfoState,
} from './redux/account-slice';
import profilesReducer, { ProfilesState } from './redux/profiles-slice';
import sharesReducer, { SharesState } from './redux/shares-slice';
import outboxReducer, { OutboxState } from './redux/outbox-slice';
import authReducer, { AuthState } from './redux/auth-slice';
import localPersistReducer, { LocalPersistState } from './redux/local-persist-slice';
import searchReducer, { SearchState } from "./redux/search-slice";
import notificationsReducer, { NotificationsState } from "./redux/notifications-slice";

export let serviceHandler: IServiceHandler;

export const initFirebase = (firebase: IFirebase, firestore: IFirestore, auth: IAuth, storage: IStorage) => {
    serviceHandler = new FirebaseServiceHandler(firebase, firestore, auth, storage);
}

export const reduxReducers = {
    accountReducer,
    profilesReducer,
    sharesReducer,
    outboxReducer,
    authReducer,
    localPersistReducer,
    searchReducer,
    notificationsReducer
};

export {
    AccountInfoState,
    ProfilesState,
    SharesState,
    OutboxState,
    AuthState,
    LocalPersistState,
    SearchState,
    NotificationsState
}

export * from './redux/account-slice';
export * from './redux/auth-slice';
export * from './redux/outbox-slice';
export * from './redux/profiles-slice';
export * from './redux/shares-slice';
export * from './redux/local-persist-slice';
export * from './redux/search-slice';
export * from './redux/notifications-slice';