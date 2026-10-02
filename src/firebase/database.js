import { getDatabase } from 'firebase/database';
import { app } from './config';

export const db = getDatabase(app);
export {
  ref, get, set, update, push, remove, onValue, onChildAdded, onChildChanged, onChildRemoved,
  query, orderByChild, orderByKey, limitToLast, endBefore, serverTimestamp, onDisconnect, runTransaction, increment,
} from 'firebase/database';
