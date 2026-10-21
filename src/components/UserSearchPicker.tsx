import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Check,
  User,
  Users,
  AlertCircle,
  Loader2,
  X,
  ClipboardPaste,
  RotateCcw,
} from 'lucide-react';
import {
  UserProfileCard,
  fetchUserProfileCard,
  loadKnownContacts,
  getAvatarColorGradient,
  getMemberInitials,
} from '../utils/shareFolders';
import {
  format16DigitId,
  format16DigitInput,
  cleanNumericId,
} from '../utils/userId';

export interface UserSearchPickerProps {
  selectedUser: UserProfileCard | null;
  onSelectUser: (user: UserProfileCard | null) => void;
  currentUserId?: string;
  accentColor?: 'blue' | 'purple';
  isArabic?: boolean;
  label?: string;
  showRecentContacts?: boolean;
  autoFocus?: boolean;
}

export const UserSearchPicker: React.FC<UserSearchPickerProps> = ({
  selectedUser,
  onSelectUser,
  currentUserId,
  accentColor = 'purple',
  isArabic = false,
  label,
  showRecentContacts = true,
  autoFocus = false,
}) => {
  const [typedId, setTypedId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [foundUser, setFoundUser] = useState<UserProfileCard | null>(null);
  const [searchStatus, setSearchStatus] = useState<
    'idle' | 'searching' | 'found' | 'not_found' | 'self_id'
  >('idle');
  const [knownContactsList, setKnownContactsList] = useState<UserProfileCard[]>([]);
  const searchTimeoutRef = useRef<any>(null);

  const cleanTyped = cleanNumericId(typedId);
  const cleanMyId = cleanNumericId(currentUserId || '');

  // Load cached contacts on mount
  useEffect(() => {
    try {
      const contactsMap = loadKnownContacts();
      const list = Object.values(contactsMap).filter(
        (c) => c && c.numericId && c.numericId.length === 16 && c.numericId !== cleanMyId
      );
      setKnownContactsList(list.slice(0, 6));
    } catch {
      setKnownContactsList([]);
    }
  }, [cleanMyId]);

  // Execute lookup
  const performSearch = async (idToSearch: string) => {
    const clean = cleanNumericId(idToSearch);
    if (clean.length !== 16) {
      setSearchStatus('idle');
      setFoundUser(null);
      return;
    }

    if (cleanMyId && clean === cleanMyId) {
      setSearchStatus('self_id');
      setFoundUser(null);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    setSearchStatus('searching');
    setFoundUser(null);

    try {
      const user = await fetchUserProfileCard(clean);
      if (user && user.numericId) {
        setFoundUser(user);
        setSearchStatus('found');
      } else {
        setFoundUser(null);
        setSearchStatus('not_found');
      }
    } catch {
      setFoundUser(null);
      setSearchStatus('not_found');
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced auto-search when 16 digits are entered
  const handleInputChange = (rawVal: string) => {
    const { clean } = format16DigitInput(rawVal, typedId);
    setTypedId(clean);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (clean.length === 16) {
      searchTimeoutRef.current = setTimeout(() => {
        performSearch(clean);
      }, 250);
    } else {
      setSearchStatus('idle');
      setFoundUser(null);
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      const clean = cleanNumericId(text).slice(0, 16);
      if (clean) {
        setTypedId(clean);
        if (clean.length === 16) {
          performSearch(clean);
        }
      }
    } catch {}
  };

  const handleChooseFoundUser = () => {
    if (foundUser) {
      onSelectUser(foundUser);
    }
  };

  const handleClearSelection = () => {
    onSelectUser(null);
    setFoundUser(null);
    setSearchStatus('idle');
    setTypedId('');
  };

  const isPurple = accentColor === 'purple';
  const borderFocusClass = isPurple ? 'focus:border-purple-500' : 'focus:border-blue-500';
  const btnAccentClass = isPurple
    ? 'bg-purple-600 hover:bg-purple-500 text-white'
    : 'bg-blue-600 hover:bg-blue-500 text-white';

  // 1. IF A USER IS ALREADY SELECTED: Render Selected User Card
  if (selectedUser) {
    return (
      <div className="space-y-2">
        {label && (
          <label className="text-xs text-zinc-300 font-bold block">
            {label}
          </label>
        )}
        <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-750 flex items-center justify-between gap-3 shadow-md animate-in fade-in">
          <div className="flex items-center gap-3 min-w-0">
            {/* Avatar / Photo */}
            <div
              className={`w-11 h-11 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-white shadow-inner bg-gradient-to-tr ${getAvatarColorGradient(
                selectedUser.numericId || selectedUser.name
              )}`}
            >
              {selectedUser.photoURL ? (
                <img
                  src={selectedUser.photoURL}
                  alt={selectedUser.name}
                  className="w-full h-full object-cover"
                />
              ) : selectedUser.avatar && selectedUser.avatar !== '👤' ? (
                <span className="text-xl">{selectedUser.avatar}</span>
              ) : (
                <span className="text-sm font-black">
                  {getMemberInitials(selectedUser.name, selectedUser.numericId)}
                </span>
              )}
            </div>

            {/* Name & ID */}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-white truncate">
                  {selectedUser.name || 'User'}
                </span>
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.2 rounded-full">
                  <Check className="w-3 h-3" />
                  <span>{isArabic ? 'تم التحقق' : 'Verified'}</span>
                </span>
              </div>
              <div className="text-xs text-zinc-400 font-mono tracking-wider mt-0.5">
                {format16DigitId(selectedUser.numericId)}
              </div>
            </div>
          </div>

          {/* Change User button */}
          <button
            type="button"
            onClick={handleClearSelection}
            className="px-2.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 active:scale-95"
            title={isArabic ? 'تغيير المستخدم' : 'Change User'}
          >
            <RotateCcw className="w-3 h-3 text-zinc-400" />
            <span>{isArabic ? 'تغيير' : 'Change'}</span>
          </button>
        </div>
      </div>
    );
  }

  // 2. INPUT & SEARCH MODE
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs text-zinc-300 font-bold block">
          {label || (isArabic ? 'المعرّف الرقمي للمستخدم (16 رقم):' : 'User 16-Digit ID:')}
        </label>
        <span
          className={`text-[11px] font-mono font-semibold ${
            cleanTyped.length === 16 ? 'text-emerald-400' : 'text-zinc-500'
          }`}
        >
          {cleanTyped.length}/16 {isArabic ? 'رقم' : 'digits'}
        </span>
      </div>

      {/* 16-Digit Partitioned Input with Quick Actions */}
      <div className="relative flex items-center">
        <input
          type="text"
          autoFocus={autoFocus}
          inputMode="numeric"
          maxLength={19}
          placeholder="4829 1038 4756 1928"
          value={format16DigitId(typedId)}
          onChange={(e) => handleInputChange(e.target.value)}
          className={`w-full px-3.5 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-white font-mono text-center text-sm sm:text-base tracking-wider placeholder-zinc-600 focus:outline-none transition ${borderFocusClass}`}
        />

        {/* Right side helper buttons */}
        <div className="absolute right-2 flex items-center gap-1">
          {cleanTyped.length === 0 ? (
            <button
              type="button"
              onClick={handlePaste}
              className="px-2 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[11px] flex items-center gap-1 transition cursor-pointer"
              title={isArabic ? 'لصق من الحافظة' : 'Paste from clipboard'}
            >
              <ClipboardPaste className="w-3 h-3 text-zinc-400" />
              <span>{isArabic ? 'لصق' : 'Paste'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setTypedId('');
                setSearchStatus('idle');
                setFoundUser(null);
              }}
              className="p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
              title={isArabic ? 'مسح' : 'Clear'}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* SEARCHING IN PROGRESS */}
      {isSearching && (
        <div className="p-3 rounded-2xl bg-zinc-900/80 border border-zinc-800 flex items-center justify-center gap-2 text-xs text-zinc-400 animate-in fade-in">
          <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
          <span>
            {isArabic
              ? 'جارٍ التحقق والبحث عن المستخدم...'
              : 'Verifying & searching for user...'}
          </span>
        </div>
      )}

      {/* DISCOVERED USER CARD (Available to Choose) */}
      {!isSearching && searchStatus === 'found' && foundUser && (
        <div className="p-3.5 rounded-2xl bg-zinc-900/90 border border-emerald-500/40 shadow-lg space-y-3 animate-in fade-in">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{isArabic ? 'تم العثور على المستخدم!' : 'User Found!'}</span>
            </span>
            <span className="text-[10px] text-zinc-400 font-mono">
              {format16DigitId(foundUser.numericId)}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-11 h-11 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center font-bold text-white shadow bg-gradient-to-tr ${getAvatarColorGradient(
                  foundUser.numericId || foundUser.name
                )}`}
              >
                {foundUser.photoURL ? (
                  <img
                    src={foundUser.photoURL}
                    alt={foundUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : foundUser.avatar && foundUser.avatar !== '👤' ? (
                  <span className="text-xl">{foundUser.avatar}</span>
                ) : (
                  <span className="text-sm font-black">
                    {getMemberInitials(foundUser.name, foundUser.numericId)}
                  </span>
                )}
              </div>

              <div className="min-w-0">
                <div className="text-sm font-bold text-white truncate">
                  {foundUser.name || 'User'}
                </div>
                <div className="text-[11px] text-zinc-400">
                  {isArabic ? 'جاهز للإضافة والتواصل' : 'Ready to add and collaborate'}
                </div>
              </div>
            </div>

            {/* Choose Button */}
            <button
              type="button"
              onClick={handleChooseFoundUser}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-md active:scale-95 ${btnAccentClass}`}
            >
              <Check className="w-3.5 h-3.5" />
              <span>{isArabic ? 'اختيار هذا المستخدم' : 'Select User'}</span>
            </button>
          </div>
        </div>
      )}

      {/* NOT FOUND ALERT */}
      {!isSearching && searchStatus === 'not_found' && cleanTyped.length === 16 && (
        <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-2.5 text-xs text-rose-300 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-bold">
              {isArabic ? 'لم يتم العثور على هذا المستخدم' : 'User Not Found'}
            </div>
            <div className="text-[11px] text-rose-300/80 mt-0.5">
              {isArabic
                ? 'يرجى التأكد من المعرّف المكوّن من 16 رقماً والمحاولة مجدداً.'
                : 'Please check the 16-digit ID and try again.'}
            </div>
          </div>
        </div>
      )}

      {/* SELF-ID ALERT */}
      {!isSearching && searchStatus === 'self_id' && (
        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs text-amber-300 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <div className="font-bold">
              {isArabic ? 'هذا معرّفك الشخصي!' : 'This is your own ID!'}
            </div>
            <div className="text-[11px] text-amber-300/80 mt-0.5">
              {isArabic
                ? 'لا يمكنك إرسال دعوة أو مشاركة الحساب مع نفسك.'
                : 'You cannot invite or share accounts with yourself.'}
            </div>
          </div>
        </div>
      )}

      {/* RECENT / KNOWN CONTACTS QUICK PICK CHIPS */}
      {showRecentContacts && knownContactsList.length > 0 && searchStatus !== 'found' && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block">
            {isArabic ? 'جهات اتصال سابقة:' : 'Recent Contacts:'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {knownContactsList.map((contact) => (
              <button
                key={contact.numericId}
                type="button"
                onClick={() => onSelectUser(contact)}
                className="px-2.5 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-xs text-zinc-300 hover:text-white flex items-center gap-2 transition cursor-pointer active:scale-95"
              >
                <div
                  className={`w-4 h-4 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-[9px] font-bold text-white bg-gradient-to-tr ${getAvatarColorGradient(
                    contact.numericId || contact.name
                  )}`}
                >
                  {contact.photoURL ? (
                    <img src={contact.photoURL} alt={contact.name} className="w-full h-full object-cover" />
                  ) : contact.avatar && contact.avatar !== '👤' ? (
                    contact.avatar
                  ) : (
                    contact.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <span className="font-medium truncate max-w-[100px]">{contact.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
