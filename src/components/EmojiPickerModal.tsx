import React from 'react';
import { X } from 'lucide-react';
import { EMOJI_PICKER_GROUPS } from '../utils/constants';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  title?: string;
}

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Choose Icon',
}) => {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-950 border border-zinc-800 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80">
          <h3 className="text-lg font-bold text-white tracking-wide">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Categorized List */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 overscroll-contain">
          {Object.entries(EMOJI_PICKER_GROUPS).map(([categoryName, emojis]) => (
            <div key={categoryName}>
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">
                {categoryName}
              </h4>
              <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                {emojis.map((emoji, idx) => (
                  <button
                    key={`${categoryName}_${idx}`}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      onClose();
                    }}
                    className="h-12 w-12 flex items-center justify-center text-2xl rounded-2xl bg-zinc-900 border border-zinc-800/80 hover:bg-zinc-800 hover:border-zinc-700 active:scale-90 transition"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
