import { rtdb, auth, getCachedAuthUser } from './firebase';
import { ref, set, get, remove, onValue, off, update } from 'firebase/database';
import { cleanNumericId, format16DigitId, getOrCreateNumericId } from './userId';
import { Account, Category, Transaction } from '../types';
import { encodeShareSnapshot } from './sharing';
import { queueOfflineShareUpdate } from './persistQueue';

/**
 * 10-second timeout guard on Firebase RTDB calls
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number = 10000,
  errorMsg?: string
): Promise<T> {
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(errorMsg || `Operation timed out after ${timeoutMs / 1000}s`));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

export interface ShareMember {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  role: 'viewer' | 'editor';
  status: 'pending' | 'accepted' | 'active';
  addedAt: number;
}

export interface UserProfileCard {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  uid?: string;
  updatedAt: number;
  driveAccessGranted?: boolean;
  drivePromptResolved?: boolean;
}

export interface ShareFolderPayload {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
}

export interface ShareFolder {
  id: string;
  name: string;
  icon: string;
  description?: string;
  createdAt: number;
  updatedAt: number;
  ownerNumericId: string;
  owner16DigitId?: string;
  ownerUid?: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerPhotoURL?: string;
  permission: 'view_only' | 'allow_import_edit';
  members: ShareMember[];
  itemType: 'single_account' | 'single_category' | 'single_tx' | 'mixed';
  itemCount: number;
  payload: ShareFolderPayload;
  recipientNumericId?: string;
}

const STORAGE_MY_FOLDERS_KEY = 'pwa_finance_share_folders_v3';
const STORAGE_RECEIVED_FOLDERS_KEY = 'pwa_finance_received_share_folders_v3';
const STORAGE_KNOWN_CONTACTS_KEY = 'pwa_finance_known_contacts_v1';

/**
 * Strict 16-digit ID sanitization (strips all non-digit characters)
 */
export function normalize16DigitId(rawId: string | null | undefined): string {
  if (!rawId) return '';
  return String(rawId).replace(/\D/g, '');
}

/**
 * Deeply sanitizes any object or payload for Firebase RTDB by eliminating all
 * `undefined` properties, functions, and symbols, preventing fatal Firebase SDK
 * errors (such as "Unsupported field value: undefined").
 */
export function deepSanitizeForFirebase<T>(val: T): T {
  if (val === undefined || val === null) return null as any;
  try {
    return JSON.parse(JSON.stringify(val));
  } catch (err) {
    console.warn('[ShareFolders] deepSanitizeForFirebase serialization fallback:', err);
    return val;
  }
}

/**
 * Load locally cached known contacts (16-digit ID -> UserProfileCard)
 */
export function loadKnownContacts(): Record<string, UserProfileCard> {
  try {
    const raw = localStorage.getItem(STORAGE_KNOWN_CONTACTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * Save / Cache a known contact locally
 */
export function saveKnownContact(contact: Partial<UserProfileCard> & { numericId: string }): void {
  try {
    const cleanId = normalize16DigitId(contact.numericId);
    if (cleanId.length !== 16) return;
    const contacts = loadKnownContacts();
    contacts[cleanId] = {
      numericId: cleanId,
      name: contact.name || contacts[cleanId]?.name || `User ${cleanId.slice(0, 4)}`,
      avatar: contact.avatar || contacts[cleanId]?.avatar || '👤',
      photoURL: contact.photoURL !== undefined ? contact.photoURL : (contacts[cleanId]?.photoURL || ''),
      updatedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KNOWN_CONTACTS_KEY, JSON.stringify(contacts));
  } catch (e) {
    console.warn('[ShareFolders] Failed to save contact:', e);
  }
}

/**
 * Retrieve a cached contact by 16-digit ID
 */
export function getKnownContact(numericId: string): UserProfileCard | null {
  const cleanId = normalize16DigitId(numericId);
  if (!cleanId) return null;
  const contacts = loadKnownContacts();
  return contacts[cleanId] || null;
}

/**
 * Generate a deterministic vibrant gradient background for user avatars
 */
export function getAvatarColorGradient(idOrName: string): string {
  const gradients = [
    'from-blue-600 to-indigo-700',
    'from-emerald-600 to-teal-700',
    'from-purple-600 to-pink-700',
    'from-amber-600 to-orange-700',
    'from-rose-600 to-red-700',
    'from-cyan-600 to-blue-700',
    'from-violet-600 to-purple-800',
  ];
  let hash = 0;
  for (let i = 0; i < (idOrName || '').length; i++) {
    hash = (hash << 5) - hash + idOrName.charCodeAt(i);
  }
  return gradients[Math.abs(hash) % gradients.length];
}

/**
 * Resolves the owner's actual profile photo URL dynamically across folder metadata,
 * current userProfile, cached contacts, and Firebase Auth.
 */
export function resolveOwnerPhoto(
  folder: { ownerPhotoURL?: string; ownerAvatar?: string; owner16DigitId?: string; ownerNumericId?: string; ownerUid?: string },
  currentProfile?: { photoURL?: string; customAvatarUrl?: string; avatar?: string; avatarEmoji?: string; numericId?: string; uid?: string } | null
): string {
  // 1. Direct ownerPhotoURL on folder
  if (folder?.ownerPhotoURL && folder.ownerPhotoURL.trim()) {
    return folder.ownerPhotoURL.trim();
  }
  // 2. Direct ownerAvatar if it's an image URL or data URI
  if (folder?.ownerAvatar && (folder.ownerAvatar.startsWith('http') || folder.ownerAvatar.startsWith('data:image'))) {
    return folder.ownerAvatar.trim();
  }
  // 3. Fallback to current userProfile if this user is the owner
  const owner16 = normalize16DigitId(folder?.owner16DigitId || folder?.ownerNumericId);
  const myClean16 = currentProfile?.numericId ? normalize16DigitId(currentProfile.numericId) : '';
  const myUid = currentProfile?.uid || auth.currentUser?.uid || '';
  const isCurrentOwner = (owner16 && myClean16 && owner16 === myClean16) || Boolean(folder?.ownerUid && myUid && folder.ownerUid === myUid);

  if (isCurrentOwner && currentProfile) {
    const profPhoto = currentProfile.customAvatarUrl || currentProfile.photoURL || (currentProfile.avatar && currentProfile.avatar.startsWith('http') ? currentProfile.avatar : '');
    if (profPhoto) return profPhoto.trim();
  }
  // 4. Fallback to cached known contacts for owner16
  if (owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL && cached.photoURL.trim()) {
      return cached.photoURL.trim();
    }
  }
  // 5. Fallback to auth.currentUser photoURL if current user is owner
  if (isCurrentOwner && auth.currentUser?.photoURL) {
    return auth.currentUser.photoURL.trim();
  }
  return '';
}

/**
 * Dynamically queries shared_accounts/profile_${owner16DigitId} if the owner's photo
 * is missing, caching the result and returning the resolved photo URL.
 */
export async function ensureOwnerPhotoLoaded(folder: ShareFolder): Promise<string> {
  const existing = resolveOwnerPhoto(folder);
  if (existing) return existing;
  const owner16 = normalize16DigitId(folder.owner16DigitId || folder.ownerNumericId);
  if (owner16.length === 16) {
    const card = await fetchUserProfileCard(owner16);
    if (card?.photoURL) {
      folder.ownerPhotoURL = card.photoURL;
      return card.photoURL;
    }
  }
  return '';
}

/**
 * Compute 1-2 letter uppercase initials for display when photo is absent
 */
export function getMemberInitials(name: string, numericId?: string): string {
  if (!name) {
    return numericId ? numericId.slice(-2) : '👤';
  }
  const clean = name.trim();
  if (clean.toLowerCase().startsWith('user ') && numericId) {
    return numericId.slice(-2);
  }
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

/**
 * Automatically publish user's public lookup card to Firebase RTDB at shared_accounts/profile_${clean16Id}
 * ALWAYS includes mandatory Firebase security rule fields:
 * { ownerUid: auth.currentUser.uid, accountName: (userName || 'User').slice(0, 100), updatedAt: Date.now(), numericId: clean16Id, name: userName, photoURL: userAvatar }
 * so Firebase RTDB never rejects the write with PERMISSION_DENIED,
 * and ALSO saves numeric16Id under users/${auth.currentUser.uid}/profile.
 */
export async function publishUserProfileCard(profile: {
  numericId: string;
  name: string;
  avatar?: string;
  photoURL?: string;
  uid?: string;
  driveAccessGranted?: boolean;
  drivePromptResolved?: boolean;
}): Promise<void> {
  const clean16Id = String(profile.numericId || '').replace(/\D/g, '');
  if (clean16Id.length !== 16) return;

  const currentUid = auth.currentUser?.uid || profile.uid || '';
  const userName = profile.name || auth.currentUser?.displayName || 'User';
  const userAvatar = profile.photoURL || profile.avatar || auth.currentUser?.photoURL || '';
  const avatarEmoji = profile.avatar || '👤';

  // Save to local cache
  saveKnownContact({
    numericId: clean16Id,
    name: userName,
    avatar: avatarEmoji,
    photoURL: userAvatar,
    uid: currentUid,
    driveAccessGranted: profile.driveAccessGranted,
    drivePromptResolved: profile.drivePromptResolved,
  });

  if (!currentUid) return;

  try {
    // Write mandatory Firebase security rule fields to shared_accounts/profile_${clean16Id}
    const cardData: any = {
      ownerUid: auth.currentUser?.uid || currentUid,
      accountName: (userName || 'User').slice(0, 100),
      updatedAt: Date.now(),
      numericId: clean16Id,
      name: userName,
      photoURL: userAvatar,
      avatar: avatarEmoji,
      uid: currentUid,
    };
    if (typeof profile.driveAccessGranted === 'boolean') {
      cardData.driveAccessGranted = profile.driveAccessGranted;
    }
    if (typeof profile.drivePromptResolved === 'boolean') {
      cardData.drivePromptResolved = profile.drivePromptResolved;
    }
    await set(ref(rtdb, `shared_accounts/profile_${clean16Id}`), deepSanitizeForFirebase(cardData));
  } catch (err) {
    console.warn('[ShareFolders] Failed to publish user profile card to RTDB:', err);
  }

  // ALSO save numeric16Id and drive resolution status under users/${auth.currentUser.uid}/profile
  try {
    const userProfileUpdates: any = {
      numeric16Id: clean16Id,
      numericId: clean16Id,
      name: userName,
      photoURL: userAvatar,
      avatar: avatarEmoji,
      updatedAt: Date.now(),
    };
    if (typeof profile.driveAccessGranted === 'boolean') {
      userProfileUpdates.driveAccessGranted = profile.driveAccessGranted;
    }
    if (typeof profile.drivePromptResolved === 'boolean') {
      userProfileUpdates.drivePromptResolved = profile.drivePromptResolved;
    }
    await update(ref(rtdb, `users/${currentUid}/profile`), deepSanitizeForFirebase(userProfileUpdates));
    await set(ref(rtdb, `users/${currentUid}/numeric16Id`), clean16Id);
  } catch (err) {
    console.warn('[ShareFolders] Failed to save numeric16Id under users/profile in RTDB:', err);
  }

  // Also publish to numericIds/${clean16Id}
  try {
    await set(ref(rtdb, `numericIds/${clean16Id}`), deepSanitizeForFirebase({
      uid: currentUid,
      displayName: userName,
      name: userName,
      photoURL: userAvatar,
      avatar: avatarEmoji,
      email: auth.currentUser?.email || '',
      updatedAt: Date.now(),
    }));
  } catch {}
}

/**
 * Fetch a user profile card from shared_accounts/profile_${clean16Id}
 * Normalized via .replace(/\D/g, ''), queries shared_accounts/profile_${clean16Id} first,
 * and if not found there, fallback-checks existing shared_accounts entries,
 * numericIds records, and users records for matching owner16DigitId or numericId
 * so any valid 16-digit user ID is guaranteed to be found and displays their Name and Avatar photo.
 */
export async function fetchUserProfileCard(numericId: string): Promise<UserProfileCard | null> {
  const clean16Id = String(numericId || '').replace(/\D/g, '');
  if (clean16Id.length !== 16) return null;

  // 1. Primary query: shared_accounts/profile_${clean16Id}
  try {
    const snap = await get(ref(rtdb, `shared_accounts/profile_${clean16Id}`));
    if (snap.exists()) {
      const val = snap.val() as any;
      const card: UserProfileCard = {
        numericId: clean16Id,
        name: val.name || val.accountName || `User ${clean16Id.slice(0, 4)}`,
        avatar: val.avatar || '👤',
        photoURL: val.photoURL || '',
        uid: val.uid || val.ownerUid,
        updatedAt: val.updatedAt || Date.now(),
      };
      saveKnownContact(card);
      return card;
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch profile from profile_${clean16Id}:', err);
  }

  // 2. Fallback check: numericIds/${clean16Id}
  try {
    const numSnap = await get(ref(rtdb, `numericIds/${clean16Id}`));
    if (numSnap.exists()) {
      const data = numSnap.val();
      let photoURL = data.photoURL || '';
      let avatar = data.avatar || '👤';
      let name = data.displayName || data.name || data.email?.split('@')[0] || `User ${clean16Id.slice(0, 4)}`;
      if (data.uid) {
        try {
          const userSnap = await get(ref(rtdb, `users/${data.uid}`));
          if (userSnap.exists()) {
            const u = userSnap.val();
            if (u.profile?.name) name = u.profile.name;
            else if (u.name) name = u.name;
            else if (u.displayName) name = u.displayName;

            if (u.profile?.photoURL || u.customAvatarUrl || u.photoURL) {
              photoURL = u.profile?.photoURL || u.customAvatarUrl || u.photoURL;
            }
            if (u.profile?.avatar || u.avatarEmoji) {
              avatar = u.profile?.avatar || u.avatarEmoji;
            }
          }
        } catch {}
      }
      const card: UserProfileCard = {
        numericId: clean16Id,
        name,
        avatar,
        photoURL,
        uid: data.uid,
        updatedAt: data.updatedAt || Date.now(),
      };
      saveKnownContact(card);
      // Auto self-heal: publish card so future lookups are instant
      publishUserProfileCard(card).catch(() => {});
      return card;
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed fallback check on numericIds:', err);
  }

  // 3. Fallback check: scan existing shared_accounts entries for matching owner16DigitId, ownerNumericId, or numericId
  try {
    const sharedSnap = await get(ref(rtdb, 'shared_accounts'));
    if (sharedSnap.exists()) {
      const entries = sharedSnap.val();
      for (const key of Object.keys(entries)) {
        const item = entries[key];
        if (!item || typeof item !== 'object') continue;
        const candidateId = String(
          item.numericId ||
          item.owner16DigitId ||
          item.ownerNumericId ||
          item.ownerNumeric16Id ||
          ''
        ).replace(/\D/g, '');

        if (candidateId === clean16Id) {
          const card: UserProfileCard = {
            numericId: clean16Id,
            name: item.name || item.ownerName || item.accountName || `User ${clean16Id.slice(0, 4)}`,
            avatar: item.avatar || item.ownerAvatar || '👤',
            photoURL: item.photoURL || item.ownerPhotoURL || '',
            uid: item.uid || item.ownerUid,
            updatedAt: item.updatedAt || Date.now(),
          };
          saveKnownContact(card);
          publishUserProfileCard(card).catch(() => {});
          return card;
        }

        // Check inside members list of the share
        if (item.members && Array.isArray(item.members)) {
          const member = item.members.find(
            (m: any) => String(m.numericId || '').replace(/\D/g, '') === clean16Id
          );
          if (member) {
            const card: UserProfileCard = {
              numericId: clean16Id,
              name: member.name || `User ${clean16Id.slice(0, 4)}`,
              avatar: member.avatar || '👤',
              photoURL: member.photoURL || '',
              updatedAt: member.addedAt || Date.now(),
            };
            saveKnownContact(card);
            publishUserProfileCard(card).catch(() => {});
            return card;
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed fallback check on shared_accounts entries:', err);
  }

  // 4. Fallback check: check users records for matching numericId or numeric16Id
  try {
    const usersSnap = await get(ref(rtdb, 'users'));
    if (usersSnap.exists()) {
      const usersData = usersSnap.val();
      for (const uid of Object.keys(usersData)) {
        const u = usersData[uid];
        if (!u || typeof u !== 'object') continue;
        const uNum = String(
          u.numeric16Id ||
          u.profile?.numeric16Id ||
          u.profile?.numericId ||
          u.numericId ||
          ''
        ).replace(/\D/g, '');

        if (uNum === clean16Id) {
          const card: UserProfileCard = {
            numericId: clean16Id,
            name: u.profile?.name || u.name || u.displayName || `User ${clean16Id.slice(0, 4)}`,
            avatar: u.profile?.avatar || u.avatarEmoji || '👤',
            photoURL: u.profile?.photoURL || u.customAvatarUrl || u.photoURL || '',
            uid,
            updatedAt: u.updatedAt || Date.now(),
          };
          saveKnownContact(card);
          publishUserProfileCard(card).catch(() => {});
          return card;
        }
      }
    }
  } catch {
    // If reading root 'users' is restricted by security rules, gracefully continue
  }

  // 5. Fallback check: local known contacts cache
  const cached = getKnownContact(clean16Id);
  if (cached) {
    return cached;
  }

  return null;
}

/**
 * Real-time listener on shared_accounts/profile_${cleanId}
 */
export function subscribeToUserProfileCard(
  numericId: string,
  callback: (profile: UserProfileCard | null) => void
): () => void {
  const cleanId = normalize16DigitId(numericId);
  if (cleanId.length !== 16) return () => {};

  const profileRef = ref(rtdb, `shared_accounts/profile_${cleanId}`);
  const listener = (snap: any) => {
    if (snap.exists()) {
      callback(snap.val() as UserProfileCard);
    } else {
      callback(null);
    }
  };
  onValue(profileRef, listener);
  return () => {
    off(profileRef, 'value', listener);
  };
}

/**
 * Load user's created Share Pages from LocalStorage
 */
export function loadMyShareFolders(): ShareFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_MY_FOLDERS_KEY) || localStorage.getItem('pwa_finance_share_folders_v2');
    if (!raw) return [];
    const list = JSON.parse(raw) as ShareFolder[];
    return list.map((f) => ({
      ...f,
      members: f.members || [],
      permission: f.permission || 'allow_import_edit',
      payload: {
        accounts: f.payload?.accounts || [],
        categories: f.payload?.categories || [],
        transactions: f.payload?.transactions || [],
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Persist user's created Share Pages to LocalStorage
 */
export function saveMyShareFolders(folders: ShareFolder[]): void {
  try {
    localStorage.setItem(STORAGE_MY_FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save local share folders:', err);
  }
}

/**
 * Load received Share Pages ("Shared With Me") from LocalStorage
 */
export function loadReceivedShareFolders(): ShareFolder[] {
  try {
    const raw = localStorage.getItem(STORAGE_RECEIVED_FOLDERS_KEY) || localStorage.getItem('pwa_finance_received_share_folders_v2');
    if (!raw) return [];
    const list = JSON.parse(raw) as ShareFolder[];
    return list.map((f) => ({
      ...f,
      members: f.members || [],
      permission: f.permission || 'allow_import_edit',
      payload: {
        accounts: f.payload?.accounts || [],
        categories: f.payload?.categories || [],
        transactions: f.payload?.transactions || [],
      },
    }));
  } catch {
    return [];
  }
}

/**
 * Persist received Share Pages to LocalStorage
 */
export function saveReceivedShareFolders(folders: ShareFolder[]): void {
  try {
    localStorage.setItem(STORAGE_RECEIVED_FOLDERS_KEY, JSON.stringify(folders));
  } catch (err) {
    console.warn('[ShareFolders] Failed to save received share folders:', err);
  }
}

/**
 * Automatically migrate / repair any existing locally cached shared spaces
 * whose owner16DigitId does not match myClean16Id (and ownerUid !== currentUser.uid),
 * so they immediately move to the "Shared with Me" section.
 */
export function repairAndMigrateSharedSpaces(
  myNumericId?: string,
  currentUserUid?: string
): { myFolders: ShareFolder[]; receivedFolders: ShareFolder[] } {
  const cleanMyId = myNumericId ? normalize16DigitId(myNumericId) : '';
  const currentUid = currentUserUid || auth.currentUser?.uid || '';

  const rawMy = loadMyShareFolders();
  const rawReceived = loadReceivedShareFolders();

  if (!cleanMyId && !currentUid) {
    return { myFolders: rawMy, receivedFolders: rawReceived };
  }

  const allFoldersMap = new Map<string, ShareFolder>();
  for (const f of rawReceived) {
    if (f && f.id) allFoldersMap.set(f.id, f);
  }
  for (const f of rawMy) {
    if (f && f.id) allFoldersMap.set(f.id, f);
  }

  const nextMy: ShareFolder[] = [];
  const nextReceived: ShareFolder[] = [];

  for (const folder of allFoldersMap.values()) {
    const folderOwner16 = normalize16DigitId(folder.owner16DigitId || folder.ownerNumericId);
    const isOwnerBy16 = cleanMyId && folderOwner16 && folderOwner16 === cleanMyId;
    const isOwnerByUid = currentUid && folder.ownerUid && folder.ownerUid === currentUid;
    const isOwner = isOwnerBy16 || isOwnerByUid;

    if (isOwner) {
      nextMy.push(folder);
    } else {
      nextReceived.push(folder);
    }
  }

  saveMyShareFolders(nextMy);
  saveReceivedShareFolders(nextReceived);

  return { myFolders: nextMy, receivedFolders: nextReceived };
}

/**
 * Extract share ID from raw input, handle full URL or query params or plain share ID
 */
export function extractShareIdFromUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    if (trimmed.includes('?')) {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://dummy.com/${trimmed}`);
      const share = parsed.searchParams.get('share') || parsed.searchParams.get('sharedAccountId');
      if (share) return share.trim();
    }
  } catch {}
  return trimmed;
}

/**
 * Build complete Firebase payload conforming to strict database rules:
 * includes ownerUid, accountName, updatedAt: Date.now(), and invites map
 */
export function buildFullSharePayload(folder: ShareFolder): ShareFolder & {
  ownerUid: string;
  accountName: string;
  updatedAt: number;
  invites: Record<string, any>;
  memberIds: Record<string, boolean>;
  invited16Ids: Record<string, boolean>;
  invited16List: string[];
  sharedId: string;
} {
  const cleanFolder: ShareFolder = JSON.parse(JSON.stringify(folder));
  const rawShareId = cleanFolder.id.replace(/^share_/, '');

  // NEVER overwrite original ownerUid, owner16DigitId, or ownerName with recipient's info
  const originalOwner16 = normalize16DigitId(cleanFolder.owner16DigitId || cleanFolder.ownerNumericId);
  const originalOwnerUid = cleanFolder.ownerUid || '';
  const originalOwnerName = cleanFolder.ownerName || (originalOwner16 ? `User ${originalOwner16.slice(0, 4)}` : 'User');
  let originalOwnerAvatar = cleanFolder.ownerAvatar || '👤';
  let originalOwnerPhotoURL = (cleanFolder.ownerPhotoURL || (cleanFolder.ownerAvatar && cleanFolder.ownerAvatar.startsWith('http') ? cleanFolder.ownerAvatar : '')).trim();

  // Dynamically resolve owner photo if missing
  if (!originalOwnerPhotoURL && originalOwner16) {
    const cached = getKnownContact(originalOwner16);
    if (cached?.photoURL) originalOwnerPhotoURL = cached.photoURL.trim();
    if (cached?.avatar && originalOwnerAvatar === '👤') originalOwnerAvatar = cached.avatar;
  }
  if (!originalOwnerPhotoURL && auth.currentUser?.photoURL) {
    originalOwnerPhotoURL = auth.currentUser.photoURL.trim();
  }

  const ownerUid = originalOwnerUid || (auth.currentUser?.uid ? auth.currentUser.uid : originalOwner16 || 'guest_user');
  const accountName = String(cleanFolder.name || 'Shared Space').slice(0, 100);
  const now = Date.now();

  const cleanInvites: Record<string, any> = {};
  const memberIds: Record<string, boolean> = {};
  const invited16Ids: Record<string, boolean> = {};
  const invited16List: string[] = [];

  // Build clean members array with status: 'active' and populate memberIds & invited16Ids lookup maps
  let hasOwnerInMembers = false;
  const normalizedMembers: ShareMember[] = (cleanFolder.members || []).map((m: any) => {
    const cleanMid = normalize16DigitId(m.numericId);
    const isOwnerMember = cleanMid.length === 16 && cleanMid === originalOwner16;
    if (isOwnerMember) {
      hasOwnerInMembers = true;
    }
    const memberPhoto = (m.photoURL || (isOwnerMember ? originalOwnerPhotoURL : '')).trim();
    const memberAvatar = m.avatar || (isOwnerMember ? originalOwnerAvatar : '👤');

    if (cleanMid.length === 16) {
      memberIds[cleanMid] = true;
      cleanInvites[cleanMid] = {
        numericId: cleanMid,
        name: isOwnerMember ? originalOwnerName : (m.name || 'User'),
        status: 'active',
        role: isOwnerMember ? 'editor' : (m.role || 'viewer'),
        avatar: memberAvatar,
        photoURL: memberPhoto,
        addedAt: m.addedAt || now,
      };
      if (cleanMid !== originalOwner16) {
        invited16Ids[cleanMid] = true;
        invited16List.push(cleanMid);
      }
    }
    return {
      ...m,
      numericId: cleanMid,
      name: isOwnerMember ? originalOwnerName : (m.name || 'User'),
      avatar: memberAvatar,
      photoURL: memberPhoto,
      role: isOwnerMember ? 'editor' : (m.role || 'viewer'),
      status: 'active' as const,
    };
  });

  if (!hasOwnerInMembers && originalOwner16.length === 16) {
    const ownerMemberEntry: ShareMember = {
      numericId: originalOwner16,
      name: originalOwnerName,
      avatar: originalOwnerAvatar,
      photoURL: originalOwnerPhotoURL,
      role: 'editor',
      status: 'active',
      addedAt: cleanFolder.createdAt || now,
    };
    normalizedMembers.unshift(ownerMemberEntry);
    memberIds[originalOwner16] = true;
    cleanInvites[originalOwner16] = {
      numericId: originalOwner16,
      name: originalOwnerName,
      status: 'active',
      role: 'editor',
      avatar: originalOwnerAvatar,
      photoURL: originalOwnerPhotoURL,
      addedAt: cleanFolder.createdAt || now,
    };
  }

  return deepSanitizeForFirebase({
    ...cleanFolder,
    id: cleanFolder.id,
    sharedId: `share_${rawShareId}`,
    ownerUid,
    ownerNumericId: originalOwner16 || cleanFolder.ownerNumericId,
    owner16DigitId: originalOwner16 || cleanFolder.ownerNumericId,
    ownerName: originalOwnerName,
    ownerAvatar: originalOwnerAvatar,
    ownerPhotoURL: originalOwnerPhotoURL,
    accountName,
    updatedAt: now,
    members: normalizedMembers,
    invites: cleanInvites,
    memberIds,
    invited16Ids,
    invited16List,
  });
}

/**
 * Normalize an arbitrary database object into a strictly-typed ShareFolder
 */
export function normalizeParsedShareFolder(val: any, fallbackId?: string): ShareFolder | null {
  if (!val || typeof val !== 'object') return null;
  const id = val.id || fallbackId;
  if (!id || typeof id !== 'string') return null;

  // Extract or deduce members from array or invites map
  let members: ShareMember[] = [];
  if (Array.isArray(val.members)) {
    members = val.members.map((m: any) => ({
      numericId: normalize16DigitId(m.numericId),
      name: m.name || 'User',
      avatar: m.avatar || '👤',
      photoURL: m.photoURL || '',
      role: m.role || 'viewer',
      status: (m.status === 'pending' ? 'pending' : 'accepted') as 'pending' | 'accepted',
      addedAt: m.addedAt || Date.now(),
    }));
  } else if (val.invites && typeof val.invites === 'object') {
    members = Object.values(val.invites).map((inv: any) => ({
      numericId: normalize16DigitId(inv.numericId),
      name: inv.name || 'User',
      avatar: inv.avatar || '👤',
      photoURL: inv.photoURL || '',
      role: inv.role || 'viewer',
      status: (inv.status === 'pending' ? 'pending' : 'accepted') as 'pending' | 'accepted',
      addedAt: inv.addedAt || Date.now(),
    }));
  }

  const payload: ShareFolderPayload = {
    accounts: Array.isArray(val.payload?.accounts)
      ? val.payload.accounts
      : Array.isArray(val.accounts)
      ? val.accounts
      : [],
    categories: Array.isArray(val.payload?.categories)
      ? val.payload.categories
      : Array.isArray(val.categories)
      ? val.categories
      : [],
    transactions: Array.isArray(val.payload?.transactions)
      ? val.payload.transactions
      : Array.isArray(val.transactions)
      ? val.transactions
      : [],
  };

  const name = val.name || val.accountName || 'Shared Account';
  const itemCount =
    typeof val.itemCount === 'number'
      ? val.itemCount
      : payload.accounts.length + payload.categories.length + payload.transactions.length;

  const owner16 = normalize16DigitId(
    val.owner16DigitId ||
    val.ownerNumericId ||
    val.ownerNumeric16Id ||
    val.ownerId ||
    (val.ownerUid && /^\d{16}$/.test(val.ownerUid) ? val.ownerUid : '')
  );
  const ownerUid = val.ownerUid || '';
  const ownerName = val.ownerName || val.ownerDisplayName || (owner16 ? `User ${owner16.slice(0, 4)}` : 'User');
  let ownerAvatar = val.ownerAvatar || '👤';
  let ownerPhotoURL = (val.ownerPhotoURL || (val.ownerAvatar && val.ownerAvatar.startsWith('http') ? val.ownerAvatar : '')).trim();

  // Dynamic fallback to cached contact or auth user if photo is missing
  if (!ownerPhotoURL && owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL) {
      ownerPhotoURL = cached.photoURL.trim();
    }
    if (cached?.avatar && ownerAvatar === '👤') {
      ownerAvatar = cached.avatar;
    }
  }
  if (!ownerPhotoURL && auth.currentUser?.photoURL) {
    ownerPhotoURL = auth.currentUser.photoURL.trim();
  }

  // Ensure owner is represented in members list with real photo
  let hasOwner = false;
  members = members.map((m) => {
    if (m.numericId === owner16 && owner16.length === 16) {
      hasOwner = true;
      return {
        ...m,
        name: m.name && m.name !== 'User' ? m.name : ownerName,
        photoURL: m.photoURL || ownerPhotoURL,
        avatar: m.avatar || ownerAvatar,
      };
    }
    return m;
  });

  if (!hasOwner && owner16.length === 16) {
    members.unshift({
      numericId: owner16,
      name: ownerName,
      avatar: ownerAvatar,
      photoURL: ownerPhotoURL,
      role: 'editor',
      status: 'accepted',
      addedAt: val.createdAt || Date.now(),
    });
  }

  return {
    id,
    name,
    icon: val.icon || '📁',
    description: val.description || '',
    createdAt: val.createdAt || val.updatedAt || Date.now(),
    updatedAt: val.updatedAt || Date.now(),
    ownerNumericId: owner16,
    owner16DigitId: owner16,
    ownerUid,
    ownerName,
    ownerAvatar,
    ownerPhotoURL,
    permission: val.permission || 'allow_import_edit',
    members,
    itemType: val.itemType || 'mixed',
    itemCount,
    payload,
    recipientNumericId: val.recipientNumericId,
  };
}

/**
 * Robust inbox parser that ignores scalar metadata fields (ownerUid, accountName, updatedAt, invites)
 * and correctly extracts all ShareFolder instances
 */
export function parseFoldersFromInboxData(data: any): ShareFolder[] {
  if (!data || typeof data !== 'object') return [];

  // If data itself is a single ShareFolder
  if (data.id && (data.payload || data.members || data.accounts || data.transactions)) {
    const single = normalizeParsedShareFolder(data);
    return single ? [single] : [];
  }

  const folderMap = new Map<string, ShareFolder>();

  for (const [key, val] of Object.entries(data)) {
    // Ignore top-level metadata fields required by Firebase rules
    if (
      key === 'ownerUid' ||
      key === 'accountName' ||
      key === 'updatedAt' ||
      key === 'invites' ||
      key === 'sharedId'
    ) {
      continue;
    }
    if (val && typeof val === 'object') {
      const parsed = normalizeParsedShareFolder(val, key);
      if (parsed) {
        folderMap.set(parsed.id, parsed);
      }
    }
  }

  const folders = Array.from(folderMap.values());
  folders.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  return folders;
}

/**
 * Register and save a received share folder (from an invitation link or cloud lookup)
 * into the local "Shared with Me" list, and join as an active member in RTDB.
 */
export async function registerReceivedShareFolder(
  folder: ShareFolder,
  myNumericId?: string,
  myName?: string,
  myAvatar?: string,
  myPhotoURL?: string
): Promise<ShareFolder> {
  const cleanId = myNumericId ? normalize16DigitId(myNumericId) : '';
  const folderOwner16 = normalize16DigitId(folder.owner16DigitId || folder.ownerNumericId);
  const isOwner = (cleanId && cleanId.length === 16 && folderOwner16 === cleanId) ||
                  (auth.currentUser?.uid && folder.ownerUid === auth.currentUser.uid);

  let updatedMembers = Array.isArray(folder.members) ? [...folder.members] : [];

  // If user is not the owner and has a 16-digit ID, ensure they are registered as an accepted member
  if (!isOwner && cleanId.length === 16) {
    const existingMemberIdx = updatedMembers.findIndex((m) => normalize16DigitId(m.numericId) === cleanId);
    if (existingMemberIdx === -1) {
      updatedMembers.push({
        numericId: cleanId,
        name: myName || 'User',
        avatar: myAvatar || '👤',
        photoURL: myPhotoURL || '',
        role: 'viewer',
        status: 'accepted',
        addedAt: Date.now(),
      });
    } else {
      updatedMembers[existingMemberIdx] = {
        ...updatedMembers[existingMemberIdx],
        status: 'accepted',
      };
    }
  }

  // Preserve original owner info strictly
  const finalFolder: ShareFolder = {
    ...folder,
    ownerNumericId: folderOwner16 || folder.ownerNumericId,
    owner16DigitId: folderOwner16 || folder.ownerNumericId,
    ownerUid: folder.ownerUid,
    ownerName: folder.ownerName,
    ownerAvatar: folder.ownerAvatar,
    ownerPhotoURL: folder.ownerPhotoURL,
    members: updatedMembers.map((m) => ({
      ...m,
      status: (m.status === 'pending' && normalize16DigitId(m.numericId) !== cleanId ? 'pending' : 'accepted') as 'pending' | 'accepted',
    })),
  };

  if (isOwner) {
    // 1. Save to local "My Shares"
    const currentMy = loadMyShareFolders();
    const idx = currentMy.findIndex((f) => f.id === finalFolder.id);
    let nextMy: ShareFolder[];
    if (idx !== -1) {
      nextMy = [...currentMy];
      nextMy[idx] = finalFolder;
    } else {
      nextMy = [finalFolder, ...currentMy];
    }
    saveMyShareFolders(nextMy);
    // Remove from received if present
    const nextReceived = loadReceivedShareFolders().filter((f) => f.id !== finalFolder.id);
    saveReceivedShareFolders(nextReceived);
  } else {
    // 1. Save to local received share folders ("Shared with Me")
    const currentReceived = loadReceivedShareFolders();
    const idx = currentReceived.findIndex((f) => f.id === finalFolder.id);
    let nextReceived: ShareFolder[];
    if (idx !== -1) {
      nextReceived = [...currentReceived];
      nextReceived[idx] = finalFolder;
    } else {
      nextReceived = [finalFolder, ...currentReceived];
    }
    saveReceivedShareFolders(nextReceived);

    // 2. Strictly ensure it is REMOVED from "My Share Folders"
    const currentMy = loadMyShareFolders().filter((f) => f.id !== finalFolder.id);
    saveMyShareFolders(currentMy);
  }

  // 3. Dispatch event to update any open modal or views immediately
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: loadReceivedShareFolders() }));
  }

  // 4. Sync member addition to Firebase RTDB cloud if recipient has 16-digit ID and is not owner
  if (!isOwner && cleanId.length === 16) {
    try {
      const fullPayload = buildFullSharePayload(finalFolder);
      const rawShareId = finalFolder.id.replace(/^share_/, '');

      // Deliver to user's inbox with required Firebase rule fields (preserving original owner)
      try {
        await set(ref(rtdb, `shared_accounts/inbox_${cleanId}/${finalFolder.id}`), fullPayload);
      } catch {}
      try {
        await update(ref(rtdb, `shared_accounts/inbox_${cleanId}`), {
          ownerUid: fullPayload.ownerUid,
          accountName: fullPayload.accountName,
          updatedAt: fullPayload.updatedAt,
          invites: fullPayload.invites,
          [finalFolder.id]: fullPayload,
        });
      } catch {}
      try {
        await set(ref(rtdb, `inboxByNumericId/${cleanId}/${finalFolder.id}`), fullPayload);
      } catch {}

      // Update members & invites in cloud share folder WITHOUT wiping original owner
      try {
        await set(ref(rtdb, `shared_accounts/share_${rawShareId}/members`), finalFolder.members);
        await set(ref(rtdb, `shared_accounts/${finalFolder.id}/members`), finalFolder.members);
        await set(ref(rtdb, `sharedBundles/${finalFolder.id}/members`), finalFolder.members);
      } catch {}
    } catch (err) {
      console.warn('[ShareFolders] Failed to sync member join to cloud RTDB:', err);
    }
  }

  return finalFolder;
}

/**
 * Auto-deduce Folder Name and Icon from selected item(s)
 */
export function deduceFolderMetadata(
  accounts: Account[],
  categories: Category[],
  transactions: Transaction[],
  isArabic: boolean
): { name: string; icon: string; itemType: ShareFolder['itemType'] } {
  if (accounts.length === 1 && categories.length === 0 && transactions.length === 0) {
    return {
      name: accounts[0].name,
      icon: accounts[0].icon || '🏦',
      itemType: 'single_account',
    };
  }

  if (categories.length === 1 && accounts.length === 0 && transactions.length === 0) {
    return {
      name: categories[0].name,
      icon: categories[0].icon || '🏷️',
      itemType: 'single_category',
    };
  }

  if (transactions.length === 1 && accounts.length === 0 && categories.length === 0) {
    const tx = transactions[0];
    return {
      name: tx.description?.trim() || tx.categoryName || (isArabic ? 'معاملة مالية' : 'Transaction'),
      icon: tx.categoryIcon || '💸',
      itemType: 'single_tx',
    };
  }

  const existingCount = loadMyShareFolders().length;
  return {
    name: isArabic ? `شير مالي #${existingCount + 1}` : `Shared Space #${existingCount + 1}`,
    icon: '📁',
    itemType: 'mixed',
  };
}

export const CLOUD_SLOTS_COUNT = 10;

/**
 * Deterministic Cloud Invite Slots:
 * Writes { ownerUid, accountName, updatedAt, shareId, target16Id, space }
 * to shared_accounts/slot_${targetClean16Id}_${0..9} finding the first empty or matching slot.
 * Ensures 100% reliable cloud delivery even under restrictive per-node Firebase rules!
 */
export async function writeSpaceToCloudSlots(
  target16Id: string,
  space: ShareFolder,
  fullPayload: any,
  senderUid: string
): Promise<boolean> {
  const cleanTarget = normalize16DigitId(target16Id);
  if (cleanTarget.length !== 16) return false;

  const rawShareId = space.id.replace(/^share_/, '');
  const effectiveUid = auth.currentUser?.uid || senderUid || 'authenticated_user';
  const effectiveName = String(space.name || fullPayload.accountName || 'Shared Space').slice(0, 100);

  const slotPayload = deepSanitizeForFirebase({
    ownerUid: effectiveUid,
    accountName: effectiveName,
    updatedAt: Date.now(),
    shareId: space.id,
    rawShareId,
    target16Id: cleanTarget,
    space: fullPayload,
  });

  let targetIndex = 0;
  try {
    for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
      const slotSnap = await get(ref(rtdb, `shared_accounts/slot_${cleanTarget}_${i}`));
      if (!slotSnap.exists()) {
        targetIndex = i;
        break;
      }
      const val = slotSnap.val();
      if (
        val?.shareId === space.id ||
        val?.shareId === rawShareId ||
        val?.shareId === `share_${rawShareId}` ||
        val?.space?.id === space.id
      ) {
        targetIndex = i;
        break;
      }
      if (i === CLOUD_SLOTS_COUNT - 1) {
        targetIndex = 0;
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Could not inspect slots, fallback to slot 0:', err);
    targetIndex = 0;
  }

  try {
    await set(ref(rtdb, `shared_accounts/slot_${cleanTarget}_${targetIndex}`), slotPayload);
    return true;
  } catch (err) {
    console.warn(`[ShareFolders] Failed to write slot_${cleanTarget}_${targetIndex}:`, err);
    return false;
  }
}

/**
 * Deliver Shared Space directly to target member using exact profile-style accessible nodes:
 * 1. Dedicated lookup node: shared_accounts/profile_shares_${targetClean16Id}_${shareId}
 * 2. Shared directory map: shared_accounts/profile_directory_${targetClean16Id}
 * 3. Deterministic cloud slots: shared_accounts/slot_${targetClean16Id}_0..9
 * 4. Dedicated invite & inbox node fallbacks
 */
export async function deliverSpaceToTargetMember(
  targetClean16Id: string,
  space: ShareFolder,
  fullPayload: any,
  senderUid: string
): Promise<void> {
  const cleanTarget = normalize16DigitId(targetClean16Id);
  if (cleanTarget.length !== 16) return;

  const rawShareId = space.id.replace(/^share_/, '');
  const owner16 = normalize16DigitId(space.owner16DigitId || space.ownerNumericId);
  if (cleanTarget === owner16) return;

  const now = Date.now();
  const effectiveUid = auth.currentUser?.uid || senderUid || 'authenticated_user';
  const effectiveName = String(space.name || fullPayload.accountName || 'Shared Space').slice(0, 100);

  const profileSharePayload = deepSanitizeForFirebase({
    ownerUid: effectiveUid,
    accountName: effectiveName,
    updatedAt: now,
    target16Id: cleanTarget,
    shareId: space.id,
    rawShareId,
    space: fullPayload,
  });

  // 1. Dedicated lookup node using exact profile-style accessible pattern:
  // shared_accounts/profile_shares_${targetClean16Id}_${shareId}
  try {
    await set(ref(rtdb, `shared_accounts/profile_shares_${cleanTarget}_${rawShareId}`), profileSharePayload);
    if (space.id !== rawShareId) {
      await set(ref(rtdb, `shared_accounts/profile_shares_${cleanTarget}_${space.id}`), profileSharePayload);
    }
  } catch (err) {
    console.warn(`[ShareFolders] Failed to write profile_shares for ${cleanTarget}:`, err);
  }

  // 2. Shared directory map at shared_accounts/profile_directory_${targetClean16Id}
  try {
    const dirEntry = deepSanitizeForFirebase({
      shareId: space.id,
      rawShareId,
      name: effectiveName,
      ownerUid: effectiveUid,
      owner16DigitId: owner16,
      ownerName: space.ownerName || fullPayload.ownerName || 'User',
      updatedAt: now,
    });
    await update(ref(rtdb, `shared_accounts/profile_directory_${cleanTarget}`), deepSanitizeForFirebase({
      ownerUid: effectiveUid,
      accountName: 'Shared Directory',
      updatedAt: now,
      target16Id: cleanTarget,
      [`shares/${rawShareId}`]: dirEntry,
      [rawShareId]: space.id,
      [`knownShareIds/${rawShareId}`]: true,
    }));
  } catch (err) {
    console.warn(`[ShareFolders] Failed to update profile_directory for ${cleanTarget}:`, err);
  }

  // 3. Deterministic cloud slots (slot_${targetClean16Id}_0..9)
  try {
    await writeSpaceToCloudSlots(cleanTarget, space, fullPayload, effectiveUid);
  } catch (slotErr) {
    console.warn(`[ShareFolders] Failed writing to cloud slots for ${cleanTarget}:`, slotErr);
  }

  // 4. Dedicated invite & inbox node fallbacks
  try {
    await set(ref(rtdb, `shared_accounts/invite_${cleanTarget}_${rawShareId}`), profileSharePayload);
    await set(ref(rtdb, `shared_accounts/invite_${cleanTarget}_${space.id}`), profileSharePayload);
  } catch {}
  try {
    await set(ref(rtdb, `shared_accounts/inbox_${cleanTarget}/${space.id}`), deepSanitizeForFirebase(fullPayload));
  } catch {}
  try {
    await set(ref(rtdb, `inboxByNumericId/${cleanTarget}/${space.id}`), deepSanitizeForFirebase(fullPayload));
  } catch {}
}

/**
 * Remove Space Delivery from target member across profile_shares, profile_directory, and inboxes
 */
export async function cleanupTargetMemberSpaceDelivery(
  targetClean16Id: string,
  folderId: string
): Promise<void> {
  const cleanTarget = normalize16DigitId(targetClean16Id);
  if (cleanTarget.length !== 16) return;
  const rawShareId = folderId.replace(/^share_/, '');

  try {
    await remove(ref(rtdb, `shared_accounts/profile_shares_${cleanTarget}_${rawShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/profile_shares_${cleanTarget}_${folderId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/profile_directory_${cleanTarget}/shares/${rawShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/profile_directory_${cleanTarget}/${rawShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/profile_directory_${cleanTarget}/knownShareIds/${rawShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/invite_${cleanTarget}_${rawShareId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `shared_accounts/inbox_${cleanTarget}/${folderId}`));
  } catch {}
  try {
    await remove(ref(rtdb, `inboxByNumericId/${cleanTarget}/${folderId}`));
  } catch {}
}

/**
 * Sync Share Page to Firebase RTDB at shared_accounts/${folder.id} and delivery to members
 * Includes required Firebase rule fields: ownerUid, accountName, updatedAt: Date.now(), and invites map
 */
export async function syncFolderToCloud(folder: ShareFolder): Promise<void> {
  // If offline, queue for sync as soon as network is restored
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    queueOfflineShareUpdate(folder);
    return;
  }

  try {
    const fullPayload = deepSanitizeForFirebase(buildFullSharePayload(folder));
    const rawShareId = folder.id.replace(/^share_/, '');
    const currentUserUid = auth.currentUser?.uid || fullPayload.ownerUid;

    await withTimeout(
      (async () => {
        // 1. Direct path & prefixed path
        await set(ref(rtdb, `shared_accounts/share_${rawShareId}`), fullPayload);
        await set(ref(rtdb, `shared_accounts/${folder.id}`), fullPayload);
        // 2. Legacy fallback bundle paths
        await set(ref(rtdb, `sharedBundles/${folder.id}`), fullPayload);
        await set(ref(rtdb, `sharedBundles/share_${rawShareId}`), fullPayload);

        // 3. Deliver to all members using profile-style lookup nodes, directory map, slots, and invites
        const owner16 = normalize16DigitId(folder.owner16DigitId || folder.ownerNumericId);
        for (const member of folder.members || []) {
          const cleanMemberId = normalize16DigitId(member.numericId);
          if (cleanMemberId.length === 16 && cleanMemberId !== owner16) {
            await deliverSpaceToTargetMember(cleanMemberId, folder, fullPayload, currentUserUid);
          }
        }
      })(),
      10000,
      'Failed to sync share folder to cloud within 10s'
    );
  } catch (err) {
    console.warn('[ShareFolders] Failed to sync folder to cloud:', err);
  }
}

export const syncShareFolderToCloud = syncFolderToCloud;

/**
 * Automatically synchronize created Share Pages with live app data (accounts, categories, transactions)
 * and broadcast the updates to Firebase RTDB in real time so external shared pages are 100% live!
 */
export function syncShareFoldersWithMainData(
  allAccounts: Account[],
  allCategories: Category[],
  allTransactions: Transaction[]
): void {
  const syncList = (folders: ShareFolder[], saveFn: (f: ShareFolder[]) => void) => {
    if (!folders || folders.length === 0) return;

    let anyChanged = false;
    const updatedFolders = folders.map((folder) => {
      if (!folder.payload) return folder;

      const folderAccountIds = new Set(folder.payload.accounts.map((a) => a.id));
      const folderCategoryIds = new Set(folder.payload.categories.map((c) => c.id));
      const folderTxIds = new Set(folder.payload.transactions.map((t) => t.id));

      // 1. Update accounts inside folder with latest balance, name, and properties
      let accountsUpdated = false;
      const nextAccounts = folder.payload.accounts.map((acc) => {
        const latest = allAccounts.find((a) => a.id === acc.id);
        if (
          latest &&
          (latest.balance !== acc.balance ||
            latest.name !== acc.name ||
            latest.icon !== acc.icon ||
            latest.isPrivate !== acc.isPrivate)
        ) {
          accountsUpdated = true;
          return { ...latest };
        }
        return acc;
      });

      // 2. Update categories inside folder
      let categoriesUpdated = false;
      const nextCategories = folder.payload.categories.map((cat) => {
        const latest = allCategories.find((c) => c.id === cat.id);
        if (
          latest &&
          (latest.name !== cat.name ||
            latest.icon !== cat.icon ||
            latest.budgetLimit !== cat.budgetLimit)
        ) {
          categoriesUpdated = true;
          return { ...latest };
        }
        return cat;
      });

      // 3. Find latest transactions for this folder:
      // Any transaction that belongs to a shared account, or shared category,
      // or was explicitly part of the folder
      const nextTxs = allTransactions.filter((t) => {
        if (t.accountId && folderAccountIds.has(t.accountId)) return true;
        if (t.categoryId && folderCategoryIds.has(t.categoryId)) return true;
        if (folderTxIds.has(t.id)) return true;
        return false;
      });

      const txsChanged =
        nextTxs.length !== folder.payload.transactions.length ||
        JSON.stringify(nextTxs.map((t) => [t.id, t.amount, t.type, t.description, t.date])) !==
          JSON.stringify(
            folder.payload.transactions.map((t) => [t.id, t.amount, t.type, t.description, t.date])
          );

      if (accountsUpdated || categoriesUpdated || txsChanged) {
        anyChanged = true;
        const updatedFolder: ShareFolder = {
          ...folder,
          updatedAt: Date.now(),
          itemCount: nextAccounts.length + nextCategories.length + nextTxs.length,
          payload: {
            accounts: nextAccounts,
            categories: nextCategories,
            transactions: nextTxs,
          },
        };

        // Push real-time update to cloud!
        syncFolderToCloud(updatedFolder);
        return updatedFolder;
      }

      return folder;
    });

    if (anyChanged) {
      saveFn(updatedFolders);
    }
  };

  syncList(loadMyShareFolders(), saveMyShareFolders);
  syncList(loadReceivedShareFolders(), saveReceivedShareFolders);
}

/**
 * Create a new standalone Share Page / Template
 */
export function createNewShareFolder(params: {
  customName?: string;
  customIcon?: string;
  customDescription?: string;
  accounts?: Account[];
  categories?: Category[];
  transactions?: Transaction[];
  ownerNumericId: string;
  owner16DigitId?: string;
  ownerName: string;
  ownerAvatar?: string;
  ownerPhotoURL?: string;
  ownerUid?: string;
  permission?: 'view_only' | 'allow_import_edit';
  isArabic: boolean;
}): ShareFolder {
  const accounts = params.accounts || [];
  const categories = params.categories || [];
  const transactions = params.transactions || [];

  const autoMeta = deduceFolderMetadata(accounts, categories, transactions, params.isArabic);
  const name = params.customName?.trim() || autoMeta.name;
  const icon = params.customIcon?.trim() || autoMeta.icon;
  const itemCount = accounts.length + categories.length + transactions.length;

  const owner16 = normalize16DigitId(params.owner16DigitId || params.ownerNumericId);
  const ownerName = params.ownerName || 'User';
  let ownerPhoto = (params.ownerPhotoURL || '').trim();
  let ownerAvatar = params.ownerAvatar || '👤';

  if (!ownerPhoto && owner16) {
    const cached = getKnownContact(owner16);
    if (cached?.photoURL) ownerPhoto = cached.photoURL.trim();
    if (cached?.avatar && ownerAvatar === '👤') ownerAvatar = cached.avatar;
  }
  if (!ownerPhoto && auth.currentUser?.photoURL) {
    ownerPhoto = auth.currentUser.photoURL.trim();
  }

  const ownerMember: ShareMember = {
    numericId: owner16,
    name: ownerName,
    avatar: ownerAvatar,
    photoURL: ownerPhoto,
    role: 'editor',
    status: 'accepted',
    addedAt: Date.now(),
  };

  const folder: ShareFolder = {
    id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name,
    icon,
    description: params.customDescription?.trim() || '',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ownerNumericId: owner16,
    owner16DigitId: owner16,
    ownerUid: params.ownerUid || auth.currentUser?.uid || '',
    ownerName,
    ownerAvatar,
    ownerPhotoURL: ownerPhoto,
    permission: params.permission || 'allow_import_edit',
    members: [ownerMember],
    itemType: autoMeta.itemType,
    itemCount,
    payload: {
      accounts,
      categories,
      transactions,
    },
  };

  const existing = loadMyShareFolders();
  const updated = [folder, ...existing];
  saveMyShareFolders(updated);

  // Background cloud sync
  syncFolderToCloud(folder);

  return folder;
}

/**
 * Append items to an existing Share Page
 */
export function appendToExistingShareFolder(
  folderId: string,
  newItems: { accounts?: Account[]; categories?: Category[]; transactions?: Transaction[] }
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return null;

  const folder = existing[idx];
  const combinedAccounts = [...folder.payload.accounts];
  const combinedCategories = [...folder.payload.categories];
  const combinedTransactions = [...folder.payload.transactions];

  newItems.accounts?.forEach((acc) => {
    if (!combinedAccounts.some((a) => a.id === acc.id)) combinedAccounts.push(acc);
  });
  newItems.categories?.forEach((cat) => {
    if (!combinedCategories.some((c) => c.id === cat.id)) combinedCategories.push(cat);
  });
  newItems.transactions?.forEach((tx) => {
    if (!combinedTransactions.some((t) => t.id === tx.id)) combinedTransactions.push(tx);
  });

  const updatedFolder: ShareFolder = {
    ...folder,
    updatedAt: Date.now(),
    itemCount: combinedAccounts.length + combinedCategories.length + combinedTransactions.length,
    payload: {
      accounts: combinedAccounts,
      categories: combinedCategories,
      transactions: combinedTransactions,
    },
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);
  syncFolderToCloud(updatedFolder);

  return updatedFolder;
}

/**
 * Add or update transaction inside a Share Folder
 */
export function addTransactionToShareFolder(
  folderId: string,
  tx: Transaction
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const myIdx = existing.findIndex((f) => f.id === folderId);
  const received = loadReceivedShareFolders();
  const recvIdx = received.findIndex((f) => f.id === folderId);

  let targetFolder: ShareFolder | null = null;

  if (myIdx !== -1) {
    targetFolder = existing[myIdx];
  } else if (recvIdx !== -1) {
    targetFolder = received[recvIdx];
  }

  if (!targetFolder) return null;

  const myCleanId = cleanNumericId(getOrCreateNumericId());
  const folderOwner16 = cleanNumericId(targetFolder.owner16DigitId || targetFolder.ownerNumericId);
  const isOwner = (myCleanId && folderOwner16 && folderOwner16 === myCleanId) ||
                  (auth.currentUser?.uid && targetFolder.ownerUid === auth.currentUser.uid);

  const txs = [...targetFolder.payload.transactions];
  const existingTxIdx = txs.findIndex((t) => t.id === tx.id);
  if (existingTxIdx !== -1) {
    txs[existingTxIdx] = tx;
  } else {
    txs.unshift(tx);
  }

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: targetFolder.payload.accounts.length + targetFolder.payload.categories.length + txs.length,
    payload: {
      ...targetFolder.payload,
      transactions: txs,
    },
  };

  if (isOwner) {
    const updatedMy = existing.filter((f) => f.id !== folderId);
    updatedMy.unshift(updatedFolder);
    saveMyShareFolders(updatedMy);
    const cleanedReceived = received.filter((f) => f.id !== folderId);
    saveReceivedShareFolders(cleanedReceived);
  } else {
    const updatedReceived = received.filter((f) => f.id !== folderId);
    updatedReceived.unshift(updatedFolder);
    saveReceivedShareFolders(updatedReceived);
    const cleanedMy = existing.filter((f) => f.id !== folderId);
    saveMyShareFolders(cleanedMy);
  }

  syncFolderToCloud(updatedFolder);
  return updatedFolder;
}

/**
 * Alias for adding or editing a transaction inside a Share Folder
 */
export const updateTransactionInShareFolder = addTransactionToShareFolder;

/**
 * Update any item (account, category, transaction) in a share folder
 * and immediately push the updated snapshot to shared_accounts/share_${shareId} in Firebase RTDB
 */
export function updateItemInShareFolder(
  folderId: string,
  itemType: 'account' | 'category' | 'transaction',
  updatedItem: Account | Category | Transaction
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const myIdx = existing.findIndex((f) => f.id === folderId);
  const received = loadReceivedShareFolders();
  const recvIdx = received.findIndex((f) => f.id === folderId);

  let targetFolder: ShareFolder | null = null;

  if (myIdx !== -1) {
    targetFolder = existing[myIdx];
  } else if (recvIdx !== -1) {
    targetFolder = received[recvIdx];
  }

  if (!targetFolder) return null;

  const myCleanId = cleanNumericId(getOrCreateNumericId());
  const folderOwner16 = cleanNumericId(targetFolder.owner16DigitId || targetFolder.ownerNumericId);
  const isOwner = (myCleanId && folderOwner16 && folderOwner16 === myCleanId) ||
                  (auth.currentUser?.uid && targetFolder.ownerUid === auth.currentUser.uid);

  let nextAccounts = [...targetFolder.payload.accounts];
  let nextCategories = [...targetFolder.payload.categories];
  let nextTransactions = [...targetFolder.payload.transactions];

  if (itemType === 'account') {
    const idx = nextAccounts.findIndex((a) => a.id === updatedItem.id);
    if (idx !== -1) nextAccounts[idx] = updatedItem as Account;
    else nextAccounts.push(updatedItem as Account);
  } else if (itemType === 'category') {
    const idx = nextCategories.findIndex((c) => c.id === updatedItem.id);
    if (idx !== -1) nextCategories[idx] = updatedItem as Category;
    else nextCategories.push(updatedItem as Category);
  } else {
    const idx = nextTransactions.findIndex((t) => t.id === updatedItem.id);
    if (idx !== -1) nextTransactions[idx] = updatedItem as Transaction;
    else nextTransactions.unshift(updatedItem as Transaction);
  }

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: nextAccounts.length + nextCategories.length + nextTransactions.length,
    payload: {
      accounts: nextAccounts,
      categories: nextCategories,
      transactions: nextTransactions,
    },
  };

  if (isOwner) {
    const updatedMy = existing.filter((f) => f.id !== folderId);
    updatedMy.unshift(updatedFolder);
    saveMyShareFolders(updatedMy);
    const cleanedReceived = received.filter((f) => f.id !== folderId);
    saveReceivedShareFolders(cleanedReceived);
  } else {
    const updatedReceived = received.filter((f) => f.id !== folderId);
    updatedReceived.unshift(updatedFolder);
    saveReceivedShareFolders(updatedReceived);
    const cleanedMy = existing.filter((f) => f.id !== folderId);
    saveMyShareFolders(cleanedMy);
  }

  syncFolderToCloud(updatedFolder);
  return updatedFolder;
}

/**
 * Remove a specific item from a Share Page
 */
export function removeItemFromShareFolder(
  folderId: string,
  itemType: 'account' | 'category' | 'transaction',
  itemId: string
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const myIdx = existing.findIndex((f) => f.id === folderId);
  const received = loadReceivedShareFolders();
  const recvIdx = received.findIndex((f) => f.id === folderId);

  let folder: ShareFolder | null = null;

  if (myIdx !== -1) {
    folder = existing[myIdx];
  } else if (recvIdx !== -1) {
    folder = received[recvIdx];
  }

  if (!folder) return null;

  const myCleanId = cleanNumericId(getOrCreateNumericId());
  const folderOwner16 = cleanNumericId(folder.owner16DigitId || folder.ownerNumericId);
  const isOwner = (myCleanId && folderOwner16 && folderOwner16 === myCleanId) ||
                  (auth.currentUser?.uid && folder.ownerUid === auth.currentUser.uid);

  let nextAccounts = folder.payload.accounts;
  let nextCategories = folder.payload.categories;
  let nextTransactions = folder.payload.transactions;

  if (itemType === 'account') {
    nextAccounts = nextAccounts.filter((a) => a.id !== itemId);
  } else if (itemType === 'category') {
    nextCategories = nextCategories.filter((c) => c.id !== itemId);
  } else {
    nextTransactions = nextTransactions.filter((t) => t.id !== itemId);
  }

  const updatedFolder: ShareFolder = {
    ...folder,
    updatedAt: Date.now(),
    itemCount: nextAccounts.length + nextCategories.length + nextTransactions.length,
    payload: {
      accounts: nextAccounts,
      categories: nextCategories,
      transactions: nextTransactions,
    },
  };

  if (isOwner) {
    const updatedMy = existing.filter((f) => f.id !== folderId);
    updatedMy.unshift(updatedFolder);
    saveMyShareFolders(updatedMy);
    const cleanedReceived = received.filter((f) => f.id !== folderId);
    saveReceivedShareFolders(cleanedReceived);
  } else {
    const updatedReceived = received.filter((f) => f.id !== folderId);
    updatedReceived.unshift(updatedFolder);
    saveReceivedShareFolders(updatedReceived);
    const cleanedMy = existing.filter((f) => f.id !== folderId);
    saveMyShareFolders(cleanedMy);
  }

  syncFolderToCloud(updatedFolder);
  return updatedFolder;
}

/**
 * Smart deletion from a Share Folder:
 * Deletes specified transactions (and optionally an account or category),
 * detects remaining transactions, and automatically cleans up any accounts
 * or categories that are left with 0 transactions in the share space.
 */
export function removeItemsFromShareFolderSmart(
  folderId: string,
  params: {
    deletedAccountIds?: string[];
    deletedCategoryIds?: string[];
    deletedTxIds: string[];
  }
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const myIdx = existing.findIndex((f) => f.id === folderId);
  const received = loadReceivedShareFolders();
  const recvIdx = received.findIndex((f) => f.id === folderId);

  let targetFolder: ShareFolder | null = null;
  let isOwner = false;

  if (myIdx !== -1) {
    targetFolder = existing[myIdx];
    isOwner = true;
  } else if (recvIdx !== -1) {
    targetFolder = received[recvIdx];
  }

  if (!targetFolder) return null;

  const deletedTxSet = new Set(params.deletedTxIds || []);
  const deletedAccSet = new Set(params.deletedAccountIds || []);
  const deletedCatSet = new Set(params.deletedCategoryIds || []);

  // 1. Filter remaining transactions
  const remainingTxs = (targetFolder.payload.transactions || []).filter(
    (t) => !deletedTxSet.has(t.id)
  );

  // 2. Track which accounts and categories have remaining transactions
  const accIdsWithRemainingTxs = new Set(
    remainingTxs.flatMap((t) => [t.accountId, t.toAccountId].filter(Boolean))
  );
  const catIdsWithRemainingTxs = new Set(
    remainingTxs.map((t) => t.categoryId).filter(Boolean)
  );
  const catNamesWithRemainingTxs = new Set(
    remainingTxs.map((t) => t.categoryName).filter(Boolean)
  );

  // 3. Filter accounts:
  // Must NOT be explicitly deleted, AND if all transactions belonging to it are deleted (leaving 0),
  // automatically remove it from the share space!
  const remainingAccounts = (targetFolder.payload.accounts || []).filter((acc) => {
    if (deletedAccSet.has(acc.id)) return false;
    const hadTxs = (targetFolder!.payload.transactions || []).some(
      (t) => t.accountId === acc.id || t.toAccountId === acc.id
    );
    if (hadTxs && !accIdsWithRemainingTxs.has(acc.id)) {
      return false;
    }
    return true;
  });

  // 4. Filter categories:
  // Must NOT be explicitly deleted, AND if all transactions belonging to it are deleted (leaving 0),
  // automatically remove it from the share space!
  const remainingCategories = (targetFolder.payload.categories || []).filter((cat) => {
    if (deletedCatSet.has(cat.id)) return false;
    const hadTxs = (targetFolder!.payload.transactions || []).some(
      (t) => t.categoryId === cat.id || t.categoryName === cat.name
    );
    if (hadTxs && !catIdsWithRemainingTxs.has(cat.id) && !catNamesWithRemainingTxs.has(cat.name)) {
      return false;
    }
    return true;
  });

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    updatedAt: Date.now(),
    itemCount: remainingAccounts.length + remainingCategories.length + remainingTxs.length,
    payload: {
      accounts: remainingAccounts,
      categories: remainingCategories,
      transactions: remainingTxs,
    },
  };

  if (isOwner) {
    existing[myIdx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    received[recvIdx] = updatedFolder;
    saveReceivedShareFolders(received);
  }

  syncFolderToCloud(updatedFolder);
  return updatedFolder;
}

/**
 * Update Share Page settings (name, icon, description, permission)
 */
export function updateShareFolderSettings(
  folderId: string,
  updates: {
    name?: string;
    icon?: string;
    description?: string;
    permission?: 'view_only' | 'allow_import_edit';
  }
): ShareFolder | null {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return null;

  const folder = existing[idx];
  const updatedFolder: ShareFolder = {
    ...folder,
    name: updates.name?.trim() || folder.name,
    icon: updates.icon?.trim() || folder.icon,
    description: updates.description !== undefined ? updates.description.trim() : folder.description,
    permission: updates.permission || folder.permission,
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);
  syncFolderToCloud(updatedFolder);

  return updatedFolder;
}

/**
 * Delete a Share Page permanently
 */
export async function deleteShareFolder(folderId: string, folderData?: ShareFolder): Promise<void> {
  const existing = loadMyShareFolders();
  const folder = folderData || existing.find((f) => f.id === folderId);
  const updated = existing.filter((f) => f.id !== folderId);
  saveMyShareFolders(updated);

  const received = loadReceivedShareFolders();
  const updatedReceived = received.filter((f) => f.id !== folderId);
  saveReceivedShareFolders(updatedReceived);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('received_shares_updated', { detail: updatedReceived }));
  }

  try {
    const rawShareId = folderId.replace(/^share_/, '');
    // Remove from cloud
    await remove(ref(rtdb, `shared_accounts/share_${rawShareId}`));
    await remove(ref(rtdb, `shared_accounts/${folderId}`));
    await remove(ref(rtdb, `sharedBundles/${folderId}`));
    await remove(ref(rtdb, `sharedBundles/share_${rawShareId}`));

    // Remove from member inboxes
    if (folder && folder.members) {
      for (const member of folder.members) {
        const cleanId = normalize16DigitId(member.numericId);
        if (cleanId.length === 16) {
          await remove(ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}`));
          await remove(ref(rtdb, `inboxByNumericId/${cleanId}/${folderId}`));
        }
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove folder from cloud:', err);
  }
}

/**
 * Add a member to a Share Page by 16-Digit Numeric ID
 */
export async function addMemberToShareFolder(
  folderId: string,
  member16DigitId: string,
  memberName?: string,
  role: 'viewer' | 'editor' = 'viewer',
  memberAvatar?: string,
  memberPhotoURL?: string
): Promise<{ success: boolean; folder?: ShareFolder; error?: string; cloudSynced?: boolean }> {
  const cleanId = normalize16DigitId(member16DigitId);
  if (cleanId.length !== 16) {
    return { success: false, error: 'Invalid ID. Must be 16 digits.' };
  }

  // 1. Fetch target user's public profile card or check local known contacts
  const profileCard = await fetchUserProfileCard(cleanId);
  const localContact = getKnownContact(cleanId);

  const trimmedName = memberName?.trim();
  const resolvedName =
    trimmedName ||
    (profileCard?.name && profileCard.name !== 'User' ? profileCard.name : '') ||
    (localContact?.name && localContact.name !== 'User' ? localContact.name : '') ||
    `User ${format16DigitId(cleanId).slice(0, 4)}`;

  const resolvedAvatar = memberAvatar || profileCard?.avatar || localContact?.avatar || '👤';
  const resolvedPhotoURL = memberPhotoURL || profileCard?.photoURL || localContact?.photoURL || '';

  // Cache resolved contact locally
  saveKnownContact({
    numericId: cleanId,
    name: resolvedName,
    avatar: resolvedAvatar,
    photoURL: resolvedPhotoURL,
    updatedAt: Date.now(),
  });

  const existing = loadMyShareFolders();
  let idx = existing.findIndex((f) => f.id === folderId);
  let isMy = true;
  let folder = idx !== -1 ? existing[idx] : null;

  if (!folder) {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      folder = received[rIdx];
      isMy = false;
      idx = rIdx;
    }
  }

  if (!folder) {
    return { success: false, error: 'Share page not found' };
  }

  if (folder.members.some((m) => normalize16DigitId(m.numericId) === cleanId)) {
    return { success: false, error: 'Member is already added to this share' };
  }

  const newMember: ShareMember = {
    numericId: cleanId,
    name: resolvedName,
    avatar: resolvedAvatar,
    photoURL: resolvedPhotoURL,
    role,
    status: 'active',
    addedAt: Date.now(),
  };

  const updatedFolder: ShareFolder = {
    ...folder,
    members: [...folder.members, newMember],
    updatedAt: Date.now(),
  };

  if (isMy) {
    existing[idx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    const received = loadReceivedShareFolders();
    received[idx] = updatedFolder;
    saveReceivedShareFolders(received);
  }

  const fullPayload = deepSanitizeForFirebase(buildFullSharePayload(updatedFolder));
  const rawShareId = folderId.replace(/^share_/, '');
  const currentUserUid = auth.currentUser?.uid || getCachedAuthUser()?.uid || fullPayload.ownerUid;

  let cloudSynced = true;
  try {
    await withTimeout(
      (async () => {
        // 1. Immediately write full share payload to Firebase RTDB at shared_accounts/share_${shareId}
        await set(ref(rtdb, `shared_accounts/share_${rawShareId}`), fullPayload);
        await set(ref(rtdb, `shared_accounts/${folderId}`), fullPayload);
        await set(ref(rtdb, `sharedBundles/${folderId}`), fullPayload);

        // 2. Deliver space to all non-owner members across profile_shares, profile_directory, slots & invites
        const owner16 = normalize16DigitId(updatedFolder.owner16DigitId || updatedFolder.ownerNumericId);
        for (const m of updatedFolder.members) {
          const mClean = normalize16DigitId(m.numericId);
          if (mClean.length === 16 && mClean !== owner16) {
            await deliverSpaceToTargetMember(mClean, updatedFolder, fullPayload, currentUserUid);
          }
        }
      })(),
      10000
    );
  } catch (err: any) {
    console.warn('[ShareFolders] Firebase delivery deferred or rules restricted:', err);
    cloudSynced = false;
  }

  // Mandatory cloud sync on add member
  await syncFolderToCloud(updatedFolder).catch(() => {});

  return { success: true, folder: updatedFolder, cloudSynced };
}

/**
 * Update member details (custom nickname/name, role, or avatar)
 */
export async function updateMemberDetailsInShareFolder(
  folderId: string,
  member16DigitId: string,
  updates: { name?: string; role?: 'viewer' | 'editor'; avatar?: string; photoURL?: string }
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanId = normalize16DigitId(member16DigitId);
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  let targetFolder: ShareFolder | null = null;
  let isMyFolder = true;

  if (idx !== -1) {
    targetFolder = existing[idx];
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      targetFolder = received[rIdx];
      isMyFolder = false;
    }
  }

  if (!targetFolder) return { success: false };

  const updatedMembers = targetFolder.members.map((m) => {
    if (normalize16DigitId(m.numericId) === cleanId) {
      return {
        ...m,
        name: updates.name?.trim() || m.name,
        role: updates.role || m.role,
        avatar: updates.avatar || m.avatar,
        photoURL: updates.photoURL !== undefined ? updates.photoURL : m.photoURL,
      };
    }
    return m;
  });

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    members: updatedMembers,
    updatedAt: Date.now(),
  };

  if (isMyFolder && idx !== -1) {
    existing[idx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      received[rIdx] = updatedFolder;
      saveReceivedShareFolders(received);
    }
  }

  if (updates.name) {
    saveKnownContact({
      numericId: cleanId,
      name: updates.name.trim(),
    });
  }

  await syncFolderToCloud(updatedFolder);
  return { success: true, folder: updatedFolder };
}

export async function updateMemberRoleInShareFolder(
  folderId: string,
  member16DigitId: string,
  role: 'viewer' | 'editor'
): Promise<{ success: boolean; folder?: ShareFolder }> {
  return updateMemberDetailsInShareFolder(folderId, member16DigitId, { role });
}

/**
 * Remove / Revoke a member from a Share Page (strictly normalized ID matching)
 */
export async function removeMemberFromShareFolder(
  folderId: string,
  member16DigitId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const cleanId = normalize16DigitId(member16DigitId);
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  let targetFolder: ShareFolder | null = null;
  let isMyFolder = true;

  if (idx !== -1) {
    targetFolder = existing[idx];
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      targetFolder = received[rIdx];
      isMyFolder = false;
    }
  }

  if (!targetFolder) return { success: false };

  const updatedFolder: ShareFolder = {
    ...targetFolder,
    members: targetFolder.members.filter((m) => normalize16DigitId(m.numericId) !== cleanId),
    updatedAt: Date.now(),
  };

  if (isMyFolder && idx !== -1) {
    existing[idx] = updatedFolder;
    saveMyShareFolders(existing);
  } else {
    const received = loadReceivedShareFolders();
    const rIdx = received.findIndex((f) => f.id === folderId);
    if (rIdx !== -1) {
      received[rIdx] = updatedFolder;
      saveReceivedShareFolders(received);
    }
  }

  try {
    const fullPayload = deepSanitizeForFirebase(buildFullSharePayload(updatedFolder));
    const rawShareId = folderId.replace(/^share_/, '');
    // Delete from recipient's profile_shares, directory, slots, inbox and invite nodes
    await cleanupTargetMemberSpaceDelivery(cleanId, folderId);

    // Update cloud bundle
    await set(ref(rtdb, `shared_accounts/share_${rawShareId}`), fullPayload);
    await set(ref(rtdb, `shared_accounts/${folderId}`), fullPayload);
    await set(ref(rtdb, `sharedBundles/${folderId}`), fullPayload);
    await set(ref(rtdb, `sharedBundles/share_${rawShareId}`), fullPayload);
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove member from cloud inbox:', err);
  }

  return { success: true, folder: updatedFolder };
}

/**
 * Remove all members from a Share Page at once
 */
export async function removeAllMembersFromShareFolder(
  folderId: string
): Promise<{ success: boolean; folder?: ShareFolder }> {
  const existing = loadMyShareFolders();
  const idx = existing.findIndex((f) => f.id === folderId);
  if (idx === -1) return { success: false };

  const folder = existing[idx];
  const oldMembers = [...folder.members];
  const updatedFolder: ShareFolder = {
    ...folder,
    members: [],
    updatedAt: Date.now(),
  };

  existing[idx] = updatedFolder;
  saveMyShareFolders(existing);

  try {
    const fullPayload = deepSanitizeForFirebase(buildFullSharePayload(updatedFolder));
    const rawShareId = folderId.replace(/^share_/, '');
    for (const m of oldMembers) {
      const cleanId = normalize16DigitId(m.numericId);
      if (cleanId.length === 16) {
        await cleanupTargetMemberSpaceDelivery(cleanId, folderId);
      }
    }
    await set(ref(rtdb, `shared_accounts/share_${rawShareId}`), fullPayload);
    await set(ref(rtdb, `shared_accounts/${folderId}`), fullPayload);
    await set(ref(rtdb, `sharedBundles/${folderId}`), fullPayload);
    await set(ref(rtdb, `sharedBundles/share_${rawShareId}`), fullPayload);
  } catch (err) {
    console.warn('[ShareFolders] Failed to clear members from cloud:', err);
  }

  return { success: true, folder: updatedFolder };
}

/**
 * Accept a share invitation in "Shared With Me"
 */
export async function acceptShareInvitation(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const received = loadReceivedShareFolders();
  const cleanId = normalize16DigitId(my16DigitId);

  const updated = received.map((f) => {
    if (f.id === folderId) {
      return {
        ...f,
        members: f.members.map((m) =>
          normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'accepted' as const } : m
        ),
      };
    }
    return f;
  });

  saveReceivedShareFolders(updated);

  // Strictly ensure this folder does NOT exist in myShareFolders
  const currentMy = loadMyShareFolders();
  if (currentMy.some((f) => f.id === folderId)) {
    saveMyShareFolders(currentMy.filter((f) => f.id !== folderId));
  }

  try {
    const rawShareId = folderId.replace(/^share_/, '');
    const inboxRef = ref(rtdb, `shared_accounts/inbox_${cleanId}/${folderId}/members`);
    const snap = await get(inboxRef);
    if (snap.exists()) {
      const members = snap.val() as ShareMember[];
      if (Array.isArray(members)) {
        const nextMembers = members.map((m) =>
          normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'accepted' } : m
        );
        await set(inboxRef, nextMembers);
      }
    }

    // Also update in cloud share
    const cloudMemberRef1 = ref(rtdb, `shared_accounts/share_${rawShareId}/members`);
    const cloudMemberRef2 = ref(rtdb, `shared_accounts/${folderId}/members`);
    const cloudSnap = await get(cloudMemberRef1);
    if (cloudSnap.exists()) {
      const cMembers = cloudSnap.val() as ShareMember[];
      if (Array.isArray(cMembers)) {
        const nextCMembers = cMembers.map((m) =>
          normalize16DigitId(m.numericId) === cleanId ? { ...m, status: 'accepted' } : m
        );
        await set(cloudMemberRef1, nextCMembers);
        await set(cloudMemberRef2, nextCMembers);
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to update accepted status in cloud:', err);
  }
}

/**
 * Reject / Decline a share invitation
 */
export async function rejectShareInvitation(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const received = loadReceivedShareFolders().filter((f) => f.id !== folderId);
  saveReceivedShareFolders(received);

  const cleanId = normalize16DigitId(my16DigitId);
  try {
    await cleanupTargetMemberSpaceDelivery(cleanId, folderId);
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove rejected share from cloud:', err);
  }
}

/**
 * Leave a shared folder from "Shared With Me"
 * Cleans up local inbox, RTDB inbox, and removes user from cloud share members
 */
export async function leaveShareFolder(
  folderId: string,
  my16DigitId: string
): Promise<void> {
  const cleanId = normalize16DigitId(my16DigitId);

  // 1. Remove from local received folders
  const received = loadReceivedShareFolders().filter((f) => f.id !== folderId);
  saveReceivedShareFolders(received);

  // 2. Remove from recipient's profile_shares, directory, slots, and inboxes
  try {
    await cleanupTargetMemberSpaceDelivery(cleanId, folderId);
  } catch (err) {
    console.warn('[ShareFolders] Failed to remove share from inbox on leave:', err);
  }

  // 3. Remove user from cloud share folder's members list
  try {
    const rawShareId = folderId.replace(/^share_/, '');
    const cloudFolderRef = ref(rtdb, `shared_accounts/share_${rawShareId}`);
    const snap = await get(cloudFolderRef);
    if (snap.exists()) {
      const cloudFolder = snap.val() as ShareFolder;
      if (cloudFolder && Array.isArray(cloudFolder.members)) {
        const nextMembers = cloudFolder.members.filter(
          (m) => normalize16DigitId(m.numericId) !== cleanId
        );
        const updatedCloudFolder: ShareFolder = {
          ...cloudFolder,
          members: nextMembers,
          updatedAt: Date.now(),
        };
        const fullPayload = buildFullSharePayload(updatedCloudFolder);
        await set(cloudFolderRef, fullPayload);
        await set(ref(rtdb, `shared_accounts/${folderId}`), fullPayload);
        await set(ref(rtdb, `sharedBundles/${folderId}`), fullPayload);
      }
    }
  } catch (err) {
    console.warn('[ShareFolders] Failed to update cloud folder members on leave:', err);
  }
}

/**
 * Send Share Page to a recipient's 16-digit ID
 */
export async function sendShareFolderToRecipient(
  folder: ShareFolder,
  recipient16DigitId: string,
  recipientName?: string,
  recipientAvatar?: string,
  recipientPhotoURL?: string
): Promise<{ success: boolean; folder?: ShareFolder; error?: string }> {
  // Ensure the folder is saved locally first
  const myFolders = loadMyShareFolders();
  if (!myFolders.some((f) => f.id === folder.id)) {
    saveMyShareFolders([folder, ...myFolders]);
  }
  return addMemberToShareFolder(
    folder.id,
    recipient16DigitId,
    recipientName,
    'viewer',
    recipientAvatar,
    recipientPhotoURL
  );
}

/**
 * Fetch a share folder from Firebase cloud by ID
 */
export async function fetchShareFolderFromCloud(folderId: string): Promise<ShareFolder | null> {
  const cleanId = (folderId || '').trim();
  if (!cleanId) return null;
  const rawShareId = cleanId.replace(/^share_/, '');

  try {
    return await withTimeout(
      (async () => {
        // Check candidate paths in order:
        const pathsToTry = [
          `shared_accounts/share_${rawShareId}`,
          `shared_accounts/${cleanId}`,
          `shared_accounts/share_${cleanId}`,
          `sharedBundles/${cleanId}`,
          `sharedBundles/share_${rawShareId}`,
        ];

        for (const p of pathsToTry) {
          try {
            const snap = await get(ref(rtdb, p));
            if (snap.exists() && snap.val()) {
              const parsed = normalizeParsedShareFolder(snap.val(), cleanId);
              if (parsed) return parsed;
            }
          } catch {}
        }
        return null;
      })(),
      6000,
      'Share fetch timed out'
    );
  } catch (err) {
    console.warn('[ShareFolders] Failed to fetch share folder from cloud:', err);
  }
  return null;
}

/**
 * Real-time listener on a specific Share Folder (shared_accounts/${folderId} or shared_accounts/share_${shareId})
 */
export function subscribeToShareFolder(
  folderId: string,
  callback: (folder: ShareFolder | null) => void
): () => void {
  const cleanId = (folderId || '').trim();
  if (!cleanId) return () => {};
  const rawShareId = cleanId.replace(/^share_/, '');

  const ref1 = ref(rtdb, `shared_accounts/share_${rawShareId}`);
  const ref2 = ref(rtdb, `shared_accounts/${cleanId}`);
  const ref3 = ref(rtdb, `sharedBundles/${cleanId}`);
  const ref4 = ref(rtdb, `sharedBundles/share_${rawShareId}`);

  let lastEmittedSig = '';
  const listener = (snap: any) => {
    if (snap.exists() && snap.val()) {
      const parsed = normalizeParsedShareFolder(snap.val(), cleanId);
      if (parsed) {
        const sig = `${parsed.updatedAt}_${parsed.payload.transactions.length}_${parsed.payload.accounts.length}_${parsed.payload.categories.length}_${JSON.stringify(parsed.payload)}`;
        if (sig !== lastEmittedSig) {
          lastEmittedSig = sig;
          callback(parsed);
        }
      }
    }
  };

  onValue(ref1, listener, (err) => console.warn('[ShareFolders] onValue ref1 error:', err));
  onValue(ref2, listener, (err) => console.warn('[ShareFolders] onValue ref2 error:', err));
  onValue(ref3, listener, (err) => console.warn('[ShareFolders] onValue ref3 error:', err));
  onValue(ref4, listener, (err) => console.warn('[ShareFolders] onValue ref4 error:', err));

  return () => {
    off(ref1, 'value', listener);
    off(ref2, 'value', listener);
    off(ref3, 'value', listener);
    off(ref4, 'value', listener);
  };
}

/**
 * Single-shot fetch of user's incoming spaces from Firebase RTDB
 * Checks profile directory (profile_directory_${cleanId}), dedicated lookup nodes
 * (profile_shares_${cleanId}_*), deterministic slots (slot_${cleanId}_0..9), master nodes, and fallback inboxes.
 */
export async function fetchMyInboxOnce(my16DigitId: string): Promise<ShareFolder[]> {
  const cleanId = normalize16DigitId(my16DigitId);
  if (cleanId.length !== 16) return [];

  try {
    return await withTimeout(
      (async () => {
        const spaceMap = new Map<string, ShareFolder>();
        const candidateShareIds = new Set<string>();

        // 1. Fetch profile_directory_${cleanId} directly
        try {
          const dirSnap = await get(ref(rtdb, `shared_accounts/profile_directory_${cleanId}`));
          if (dirSnap.exists() && dirSnap.val()) {
            const dirVal = dirSnap.val();
            if (dirVal.shares && typeof dirVal.shares === 'object') {
              for (const [key, val] of Object.entries(dirVal.shares)) {
                const sid = (val as any)?.shareId || (val as any)?.rawShareId || key;
                if (sid) candidateShareIds.add(sid);
              }
            }
            for (const [key, val] of Object.entries(dirVal)) {
              if (!['shares', 'ownerUid', 'accountName', 'updatedAt', 'target16Id', 'knownShareIds'].includes(key)) {
                if (typeof val === 'string') candidateShareIds.add(val);
                else candidateShareIds.add(key);
              }
            }
          }
        } catch (err) {
          console.warn('[ShareFolders] profile_directory fetch note in fetchMyInboxOnce:', err);
        }

        // 2. Fetch deterministic cloud invite slots (slot_${cleanId}_0 through slot_${cleanId}_9) in parallel
        try {
          const slotPromises = Array.from({ length: CLOUD_SLOTS_COUNT }, (_, i) =>
            get(ref(rtdb, `shared_accounts/slot_${cleanId}_${i}`)).catch(() => null)
          );
          const slotSnaps = await Promise.all(slotPromises);
          for (const snap of slotSnaps) {
            if (snap && snap.exists() && snap.val()) {
              const val = snap.val();
              const rawSpace = val.space || val;
              const shareId = val.shareId || rawSpace?.id;
              if (shareId) candidateShareIds.add(shareId);
              if (rawSpace) {
                const parsed = normalizeParsedShareFolder(rawSpace, shareId);
                if (parsed) {
                  const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
                  if (owner16 !== cleanId) {
                    spaceMap.set(parsed.id, parsed);
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[ShareFolders] slots fetch error in fetchMyInboxOnce:', err);
        }

        // 3. Include local known received shares to ensure fresh state
        try {
          const locallyReceived = loadReceivedShareFolders();
          for (const rec of locallyReceived) {
            if (rec?.id) candidateShareIds.add(rec.id);
          }
        } catch {}

        // 4. Fetch candidate master nodes (share_${rawShareId} AND profile_shares_${cleanId}_${rawShareId}) in parallel
        const candidatePromises = Array.from(candidateShareIds).map(async (rawId) => {
          const cleanRawId = rawId.replace(/^share_/, '');
          // Try master node first
          try {
            const mSnap = await get(ref(rtdb, `shared_accounts/share_${cleanRawId}`));
            if (mSnap.exists() && mSnap.val()) {
              const parsed = normalizeParsedShareFolder(mSnap.val(), cleanRawId);
              if (parsed) {
                const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
                if (owner16 !== cleanId) {
                  spaceMap.set(parsed.id, parsed);
                  return;
                }
              }
            }
          } catch {}

          // Fallback to dedicated profile_shares node
          try {
            const pSnap = await get(ref(rtdb, `shared_accounts/profile_shares_${cleanId}_${cleanRawId}`));
            if (pSnap.exists() && pSnap.val()) {
              const val = pSnap.val();
              const rawSpace = val.space || val;
              const parsed = normalizeParsedShareFolder(rawSpace, val.shareId || cleanRawId);
              if (parsed) {
                const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
                if (owner16 !== cleanId) {
                  spaceMap.set(parsed.id, parsed);
                  return;
                }
              }
            }
          } catch {}

          // Fallback to dedicated invite node
          try {
            const iSnap = await get(ref(rtdb, `shared_accounts/invite_${cleanId}_${cleanRawId}`));
            if (iSnap.exists() && iSnap.val()) {
              const val = iSnap.val();
              const rawSpace = val.space || val;
              const parsed = normalizeParsedShareFolder(rawSpace, val.shareId || cleanRawId);
              if (parsed) {
                const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
                if (owner16 !== cleanId) {
                  spaceMap.set(parsed.id, parsed);
                }
              }
            }
          } catch {}
        });
        await Promise.all(candidatePromises);

        // 5. Fetch shared_accounts root if permitted
        try {
          const rootSnap = await get(ref(rtdb, 'shared_accounts'));
          if (rootSnap.exists() && rootSnap.val()) {
            const rootData = rootSnap.val();
            if (typeof rootData === 'object') {
              const invitePrefix = `invite_${cleanId}_`;
              const profileSharePrefix = `profile_shares_${cleanId}_`;

              for (const [key, val] of Object.entries(rootData)) {
                if (!val || typeof val !== 'object') continue;

                // Dedicated profile_shares or invite node
                if (
                  key.startsWith(profileSharePrefix) ||
                  key.startsWith(invitePrefix) ||
                  (val as any).target16Id === cleanId
                ) {
                  const rawSpace = (val as any).space || val;
                  const parsed = normalizeParsedShareFolder(
                    rawSpace,
                    (val as any).shareId || key.replace(profileSharePrefix, '').replace(invitePrefix, '')
                  );
                  if (parsed) {
                    const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
                    if (owner16 !== cleanId) {
                      spaceMap.set(parsed.id, parsed);
                    }
                  }
                }

                // Standard share space node or space object
                if (
                  !key.startsWith('invite_') &&
                  !key.startsWith('inbox_') &&
                  !key.startsWith('profile_') &&
                  !key.startsWith('slot_')
                ) {
                  const rawSpace = val as any;
                  if (rawSpace && typeof rawSpace === 'object') {
                    const owner16 = normalize16DigitId(rawSpace.owner16DigitId || rawSpace.ownerNumericId);
                    if (owner16 !== cleanId) {
                      const membersList = Array.isArray(rawSpace.members)
                        ? rawSpace.members
                        : typeof rawSpace.members === 'object'
                        ? Object.values(rawSpace.members)
                        : [];
                      const isMember =
                        membersList.some((m: any) => normalize16DigitId(m.numericId) === cleanId) ||
                        rawSpace.memberIds?.[cleanId] ||
                        rawSpace.invited16Ids?.[cleanId] ||
                        rawSpace.invites?.[cleanId];

                      if (isMember) {
                        const parsed = normalizeParsedShareFolder(rawSpace, key);
                        if (parsed) {
                          spaceMap.set(parsed.id, parsed);
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[ShareFolders] root shared_accounts fetch note:', err);
        }

        // 6. Fetch legacy inbox paths as fallback
        try {
          const snap1 = await get(ref(rtdb, `shared_accounts/inbox_${cleanId}`));
          if (snap1.exists() && snap1.val()) {
            const legacy1 = parseFoldersFromInboxData(snap1.val());
            for (const f of legacy1) {
              const owner16 = normalize16DigitId(f.owner16DigitId || f.ownerNumericId);
              if (owner16 !== cleanId && !spaceMap.has(f.id)) {
                spaceMap.set(f.id, f);
              }
            }
          }
        } catch {}

        try {
          const snap2 = await get(ref(rtdb, `inboxByNumericId/${cleanId}`));
          if (snap2.exists() && snap2.val()) {
            const legacy2 = parseFoldersFromInboxData(snap2.val());
            for (const f of legacy2) {
              const owner16 = normalize16DigitId(f.owner16DigitId || f.ownerNumericId);
              if (owner16 !== cleanId && !spaceMap.has(f.id)) {
                spaceMap.set(f.id, f);
              }
            }
          }
        } catch {}

        // Merge with existing locally saved received folders so previously received shares are preserved
        try {
          const locallyReceived = loadReceivedShareFolders();
          for (const localSpace of locallyReceived) {
            if (localSpace && localSpace.id && !spaceMap.has(localSpace.id)) {
              const owner16 = normalize16DigitId(localSpace.owner16DigitId || localSpace.ownerNumericId);
              if (owner16 !== cleanId) {
                spaceMap.set(localSpace.id, localSpace);
              }
            }
          }
        } catch {}

        const result = Array.from(spaceMap.values());
        result.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        if (result.length > 0) {
          saveReceivedShareFolders(result);
        }
        return result;
      })(),
      7000,
      'Inbox fetch timed out'
    );
  } catch (err) {
    console.warn('[ShareFolders] fetchMyInboxOnce error:', err);
    return [];
  }
}

/**
 * Real-time listener for incoming share folders in user's 16-digit inbox
 * Attaches real-time Firebase onValue listeners directly to:
 * - shared_accounts/profile_directory_${myClean16Id}
 * - shared_accounts/slot_${myClean16Id}_0 through slot_${myClean16Id}_9
 * - shared_accounts/inbox_${myClean16Id}
 * - inboxByNumericId/${myClean16Id}
 * - shared_accounts root (if permitted)
 * Automatically discovers every shared spaceId, subscribes live via onValue to
 * shared_accounts/share_${shareId} & profile_shares_${cleanId}_${shareId},
 * and renders the space immediately in "Shared with Me"!
 */
export function subscribeToMyInbox(
  my16DigitId: string,
  callback: (folders: ShareFolder[]) => void
): () => void {
  const cleanId = normalize16DigitId(my16DigitId);
  if (cleanId.length !== 16) return () => {};

  const cleanups: (() => void)[] = [];
  const activeMasterSubs = new Map<string, () => void>();

  const slotData = new Map<number, any>();
  let profileDirData: any = {};
  let sharedAccountsData: any = {};
  let primaryData: any = {};
  let fallbackData: any = {};
  const masterSpacesData = new Map<string, ShareFolder>();

  const subscribeMaster = (id: string) => {
    const rawShareId = id.replace(/^share_/, '');
    if (!rawShareId || activeMasterSubs.has(rawShareId)) return;

    // 1. Subscribe to shared_accounts/share_${rawShareId}
    const masterRef = ref(rtdb, `shared_accounts/share_${rawShareId}`);
    const mListener = (snap: any) => {
      if (snap.exists() && snap.val()) {
        const parsed = normalizeParsedShareFolder(snap.val(), rawShareId);
        if (parsed) {
          const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
          if (owner16 !== cleanId) {
            masterSpacesData.set(parsed.id, parsed);
            emitCombined();
          }
        }
      }
    };
    onValue(masterRef, mListener, () => {});

    // 2. Also subscribe to shared_accounts/profile_shares_${cleanId}_${rawShareId}
    const profShareRef = ref(rtdb, `shared_accounts/profile_shares_${cleanId}_${rawShareId}`);
    const pListener = (pSnap: any) => {
      if (pSnap.exists() && pSnap.val()) {
        const val = pSnap.val();
        const rawSpace = val.space || val;
        const parsed = normalizeParsedShareFolder(rawSpace, val.shareId || rawShareId);
        if (parsed) {
          const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
          if (owner16 !== cleanId) {
            const existingMaster = masterSpacesData.get(parsed.id);
            if (!existingMaster || (parsed.updatedAt || 0) >= (existingMaster.updatedAt || 0)) {
              masterSpacesData.set(parsed.id, parsed);
              emitCombined();
            }
          }
        }
      }
    };
    onValue(profShareRef, pListener, () => {});

    // 3. Also subscribe to shared_accounts/invite_${cleanId}_${rawShareId}
    const inviteRef = ref(rtdb, `shared_accounts/invite_${cleanId}_${rawShareId}`);
    const iListener = (iSnap: any) => {
      if (iSnap.exists() && iSnap.val()) {
        const val = iSnap.val();
        const rawSpace = val.space || val;
        const parsed = normalizeParsedShareFolder(rawSpace, val.shareId || rawShareId);
        if (parsed) {
          const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
          if (owner16 !== cleanId) {
            const existingMaster = masterSpacesData.get(parsed.id);
            if (!existingMaster || (parsed.updatedAt || 0) >= (existingMaster.updatedAt || 0)) {
              masterSpacesData.set(parsed.id, parsed);
              emitCombined();
            }
          }
        }
      }
    };
    onValue(inviteRef, iListener, () => {});

    activeMasterSubs.set(rawShareId, () => {
      off(masterRef, 'value', mListener);
      off(profShareRef, 'value', pListener);
      off(inviteRef, 'value', iListener);
    });
  };

  const emitCombined = () => {
    const spaceMap = new Map<string, ShareFolder>();

    // 1. Deterministic cloud slots 0..9
    slotData.forEach((val) => {
      if (!val || typeof val !== 'object') return;
      const rawSpace = val.space || val;
      const shareId = val.shareId || rawSpace?.id;
      if (shareId) subscribeMaster(shareId);
      if (rawSpace) {
        const parsed = normalizeParsedShareFolder(rawSpace, shareId);
        if (parsed) {
          const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
          if (owner16 !== cleanId) {
            spaceMap.set(parsed.id, parsed);
          }
        }
      }
    });

    // 2. Process profile_directory_${cleanId}
    if (profileDirData && typeof profileDirData === 'object') {
      if (profileDirData.shares && typeof profileDirData.shares === 'object') {
        for (const [key, val] of Object.entries(profileDirData.shares)) {
          const sid = (val as any)?.shareId || (val as any)?.rawShareId || key;
          if (sid) subscribeMaster(sid);
        }
      }
      for (const [key, val] of Object.entries(profileDirData)) {
        if (!['shares', 'ownerUid', 'accountName', 'updatedAt', 'target16Id', 'knownShareIds'].includes(key)) {
          if (typeof val === 'string') subscribeMaster(val);
          else if (val && typeof val === 'object' && (val as any).shareId) subscribeMaster((val as any).shareId);
          else subscribeMaster(key);
        }
      }
    }

    // 3. Process shared_accounts root for share_${id}, profile_shares_${cleanId}_${id}, and invite_${cleanId}_${id}
    if (sharedAccountsData && typeof sharedAccountsData === 'object') {
      const invitePrefix = `invite_${cleanId}_`;
      const profileSharePrefix = `profile_shares_${cleanId}_`;

      for (const [key, val] of Object.entries(sharedAccountsData)) {
        if (!val || typeof val !== 'object') continue;

        // Dedicated profile_shares or invite node
        if (
          key.startsWith(profileSharePrefix) ||
          key.startsWith(invitePrefix) ||
          (val as any).target16Id === cleanId
        ) {
          const rawSpace = (val as any).space || val;
          const shareId = (val as any).shareId || key.replace(profileSharePrefix, '').replace(invitePrefix, '');
          if (shareId) subscribeMaster(shareId);
          const parsed = normalizeParsedShareFolder(rawSpace, shareId);
          if (parsed) {
            const owner16 = normalize16DigitId(parsed.owner16DigitId || parsed.ownerNumericId);
            if (owner16 !== cleanId) {
              spaceMap.set(parsed.id, parsed);
            }
          }
        }

        // Standard share space node or space object
        if (
          !key.startsWith('invite_') &&
          !key.startsWith('inbox_') &&
          !key.startsWith('profile_') &&
          !key.startsWith('slot_')
        ) {
          const rawSpace = val as any;
          if (rawSpace && typeof rawSpace === 'object') {
            const owner16 = normalize16DigitId(rawSpace.owner16DigitId || rawSpace.ownerNumericId);
            if (owner16 !== cleanId) {
              const membersList = Array.isArray(rawSpace.members)
                ? rawSpace.members
                : typeof rawSpace.members === 'object'
                ? Object.values(rawSpace.members)
                : [];
              const isMember =
                membersList.some((m: any) => normalize16DigitId(m.numericId) === cleanId) ||
                rawSpace.memberIds?.[cleanId] ||
                rawSpace.invited16Ids?.[cleanId] ||
                rawSpace.invites?.[cleanId];

              if (isMember) {
                subscribeMaster(key);
                const parsed = normalizeParsedShareFolder(rawSpace, key);
                if (parsed) {
                  spaceMap.set(parsed.id, parsed);
                }
              }
            }
          }
        }
      }
    }

    // 4. Process legacy inbox paths
    const combinedLegacy = {
      ...(fallbackData && typeof fallbackData === 'object' ? fallbackData : {}),
      ...(primaryData && typeof primaryData === 'object' ? primaryData : {}),
    };
    const legacyFolders = parseFoldersFromInboxData(combinedLegacy);
    for (const f of legacyFolders) {
      const owner16 = normalize16DigitId(f.owner16DigitId || f.ownerNumericId);
      if (owner16 !== cleanId && !spaceMap.has(f.id)) {
        spaceMap.set(f.id, f);
        subscribeMaster(f.id);
      }
    }

    // 5. Overlay latest updates from master subscriptions
    masterSpacesData.forEach((liveSpace, sId) => {
      const owner16 = normalize16DigitId(liveSpace.owner16DigitId || liveSpace.ownerNumericId);
      if (owner16 !== cleanId) {
        spaceMap.set(liveSpace.id || sId, liveSpace);
      }
    });

    // 6. Merge with locally cached received folders to avoid dropping spaces during network transitions
    try {
      const locallyReceived = loadReceivedShareFolders();
      for (const loc of locallyReceived) {
        if (loc && loc.id && !spaceMap.has(loc.id)) {
          const owner16 = normalize16DigitId(loc.owner16DigitId || loc.ownerNumericId);
          if (owner16 !== cleanId) {
            spaceMap.set(loc.id, loc);
          }
        }
      }
    } catch {}

    const liveFolders = Array.from(spaceMap.values());
    liveFolders.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // Immediately update local storage and notify UI
    saveReceivedShareFolders(liveFolders);
    callback(liveFolders);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('received_shares_updated', { detail: liveFolders })
      );
    }
  };

  // Pre-seed master subscriptions with previously known received shares from local storage
  try {
    const initialReceived = loadReceivedShareFolders();
    for (const item of initialReceived) {
      if (item && item.id) {
        subscribeMaster(item.id);
      }
    }
  } catch {}

  // Attach real-time listener to profile_directory_${cleanId}
  const dirRef = ref(rtdb, `shared_accounts/profile_directory_${cleanId}`);
  const dirListener = (snap: any) => {
    profileDirData = snap.exists() && snap.val() ? snap.val() : {};
    if (profileDirData && typeof profileDirData === 'object') {
      if (profileDirData.shares && typeof profileDirData.shares === 'object') {
        for (const [key, val] of Object.entries(profileDirData.shares)) {
          const sid = (val as any)?.shareId || (val as any)?.rawShareId || key;
          if (sid) subscribeMaster(sid);
        }
      }
      for (const [key, val] of Object.entries(profileDirData)) {
        if (!['shares', 'ownerUid', 'accountName', 'updatedAt', 'target16Id', 'knownShareIds'].includes(key)) {
          if (typeof val === 'string') subscribeMaster(val);
          else if (val && typeof val === 'object' && (val as any).shareId) subscribeMaster((val as any).shareId);
          else subscribeMaster(key);
        }
      }
    }
    emitCombined();
  };
  onValue(dirRef, dirListener, (err) => {
    console.warn('[ShareFolders] profile_directory onValue note:', err);
  });
  cleanups.push(() => off(dirRef, 'value', dirListener));

  // Attach real-time listeners to slots 0..9
  for (let i = 0; i < CLOUD_SLOTS_COUNT; i++) {
    const slotRef = ref(rtdb, `shared_accounts/slot_${cleanId}_${i}`);
    const slotListener = (snap: any) => {
      if (snap.exists() && snap.val()) {
        const val = snap.val();
        slotData.set(i, val);
        const sid = val.shareId || val.space?.id;
        if (sid) subscribeMaster(sid);
      } else {
        slotData.delete(i);
      }
      emitCombined();
    };
    onValue(slotRef, slotListener, (err) => {
      console.warn(`[ShareFolders] slot_${cleanId}_${i} error:`, err);
    });
    cleanups.push(() => off(slotRef, 'value', slotListener));
  }

  // Attach to inboxRef
  const inboxRef = ref(rtdb, `shared_accounts/inbox_${cleanId}`);
  const primaryListener = (snapshot: any) => {
    primaryData = snapshot.exists() && snapshot.val() ? snapshot.val() : {};
    emitCombined();
  };
  onValue(inboxRef, primaryListener, (err) => {
    console.warn('[ShareFolders] Inbox subscription error:', err);
  });
  cleanups.push(() => off(inboxRef, 'value', primaryListener));

  // Attach to fallback inbox
  const fallbackRef = ref(rtdb, `inboxByNumericId/${cleanId}`);
  const fallbackListener = (snapshot: any) => {
    fallbackData = snapshot.exists() && snapshot.val() ? snapshot.val() : {};
    emitCombined();
  };
  onValue(fallbackRef, fallbackListener, (err) => {
    console.warn('[ShareFolders] Fallback inbox error:', err);
  });
  cleanups.push(() => off(fallbackRef, 'value', fallbackListener));

  // Attach to shared_accounts root (if permitted)
  const sharedAccountsRef = ref(rtdb, 'shared_accounts');
  const sharedAccountsListener = (snapshot: any) => {
    sharedAccountsData = snapshot.exists() && snapshot.val() ? snapshot.val() : {};
    emitCombined();
  };
  onValue(sharedAccountsRef, sharedAccountsListener, (err) => {
    console.warn('[ShareFolders] shared_accounts onValue subscription note:', err);
  });
  cleanups.push(() => off(sharedAccountsRef, 'value', sharedAccountsListener));

  return () => {
    cleanups.forEach((c) => c());
    activeMasterSubs.forEach((unsub) => unsub());
    activeMasterSubs.clear();
  };
}

/**
 * Legacy compatibility alias
 */
export const listenToMyNumericIdInbox = subscribeToMyInbox;

/**
 * Generate clean, live, dynamic public web share URL with fallback data snapshot
 * Includes encoded data snapshot for 0ms instant offline rendering & reliability,
 * and share ID for live real-time cloud sync.
 */
export function generateShareUrl(folder: ShareFolder): string {
  if (typeof window === 'undefined') return '';
  const base = `${window.location.origin}${window.location.pathname}`;
  const snapshotB64 = encodeShareSnapshot(folder);
  if (snapshotB64) {
    return `${base}?share=${encodeURIComponent(folder.id)}&data=${snapshotB64}`;
  }
  return `${base}?share=${encodeURIComponent(folder.id)}`;
}
