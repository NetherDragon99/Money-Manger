import React, { useState, useMemo } from 'react';
import { X, Search, Sparkles, Check, Smile } from 'lucide-react';
import { EMOJI_PICKER_GROUPS } from '../utils/constants';

interface EmojiPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
  title?: string;
}

// Icon search tags dictionary for lightning-fast keyword matching
const ICON_KEYWORDS: Record<string, string> = {
  // Finance & Accounts
  '🏦': 'bank central branch account finance',
  '🏧': 'atm cash machine withdrawal money',
  '👛': 'wallet purse money pocket',
  '🪙': 'coin gold currency change crypto',
  '💵': 'cash dollar bill paper money notes',
  '💶': 'euro europe currency money',
  '💷': 'pound gbp sterling uk currency',
  '💴': 'yen japan cny asian currency',
  '💳': 'credit card debit visa mastercard payment',
  '🔒': 'safe lock secure private security vault',
  '🗄️': 'vault safe filing cabinet deposit',
  '🐷': 'piggy bank savings reserve stash',
  '💰': 'money bag treasure wealth revenue cash',
  '📈': 'stocks growth profit chart increase bull',
  '📉': 'stocks loss drop chart decrease bear',
  '💎': 'diamond crypto gold luxury jewel wealth',
  '🧾': 'receipt bill invoice tax audit invoice',
  '🏛️': 'treasury bank government court institution',
  '⚖️': 'audit balance justice legal scale',
  '💼': 'portfolio briefcase business career investment',
  '💹': 'market exchange forex trading currency rise',
  '🛡️': 'insurance protect guard security guarantee',
  '🏷️': 'voucher tag coupon discount code',
  '📊': 'analytics chart statistics report metrics',
  '💸': 'transfer send money wings spending expense',
  '🔑': 'key access safe pass code credential',
  '📦': 'assets inventory goods delivery supplies',
  '🧮': 'calculator ledger abacus accounting math',
  '🥇': 'gold prize first wealth winner',
  '🥈': 'silver second savings reward',
  '🥉': 'bronze third medal investment',
  '⭐': 'star favorite priority top rating',

  // Food & Dining
  '🍔': 'burger fastfood dining dinner meal beef',
  '🍕': 'pizza slice cheese italian dining takeout',
  '🍣': 'sushi japanese fish dining seafood',
  '🍲': 'stew soup bowl hotpot meal dining cooking',
  '🥐': 'bakery pastry bread breakfast croissant',
  '🍟': 'fries fastfood snacks potato',
  '🥪': 'sandwich lunch deli meal breakfast',
  '🥗': 'salad healthy diet vegan veggies greens',
  '☕': 'coffee cafe latte espresso morning brew',
  '🍺': 'beer pub drinks alcohol bar draft',
  '🍷': 'wine bar dining celebration glass grapes',
  '🍎': 'groceries apple fruit fresh supermarket',
  '🥦': 'broccoli vegetables groceries healthy greens',
  '🍓': 'strawberry berries fruit sweet fresh',
  '🍰': 'cake bakery dessert birthday sweet pastry',
  '🥞': 'pancakes breakfast brunch syrup sweet',
  '🍩': 'donut dessert sweet bakery snack',
  '🥑': 'avocado healthy groceries produce toast',
  '🌮': 'taco mexican dining dinner spicy takeout',
  '🥩': 'meat butcher steak beef protein cooking',
  '🍜': 'noodles ramen asian soup dining bowl',
  '🍛': 'curry rice dining meal spicy bowl',
  '🍱': 'bento japanese lunch meal dining',
  '🍦': 'ice cream sweet dessert summer dairy cone',
  '🧃': 'juice drink beverage kids box smoothie',
  '🍵': 'tea green tea matcha warm drink herbal',
  '🥂': 'celebration party toast champagne event',
  '🍿': 'popcorn movie cinema snacks treats',
  '🧁': 'cupcake dessert sweet muffin bakery',
  '🍪': 'cookie bakery snack chocolate biscuit',
  '🧆': 'falafel arabic vegetarian dining street',
  '🥙': 'shawarma wrap arabic kebab sandwich dining',
  '🌭': 'hotdog fastfood stadium snack sausage',
  '🍳': 'breakfast eggs cooking skillet morning',
  '🥖': 'baguette bread bakery supermarket loaf',
  '🍉': 'watermelon fruit summer sweet produce',

  // Shopping & Lifestyle
  '🛍️': 'shopping bags mall retail fashion purchases',
  '🛒': 'supermarket cart grocery shopping store',
  '👕': 'clothing shirt tshirt apparel clothes wear',
  '👗': 'dress fashion clothing outfit wear party',
  '👟': 'shoes sneakers sports footwear runners athletic',
  '👠': 'heels fashion footwear luxury shoes',
  '👒': 'hat accessories fashion sun style',
  '💄': 'cosmetics makeup beauty lipstick skincare',
  '💍': 'jewelry ring gold wedding diamond engagement',
  '🕶️': 'sunglasses shades eyewear luxury style',
  '⌚': 'watch smartwatch time accessories apple',
  '🧥': 'coat jacket winter wear clothes warm',
  '🩳': 'shorts swimming sportswear clothes beach',
  '👜': 'handbag purse luxury leather bag accessories',
  '🎒': 'backpack school travel bag laptop pack',
  '🧦': 'socks apparel footwear warm',
  '🧣': 'scarf winter accessories clothes warm',
  '📿': 'necklace beads accessories jewelry rosary',
  '🧴': 'lotion skincare shampoo hygiene personal beauty',
  '💈': 'barber haircut salon hair grooming styling',
  '🪒': 'shaving grooming razor personal care blade',
  '✂️': 'scissors salon cut craft tailoring',
  '🎁': 'gift present birthday holiday surprise donations',
  '🎮': 'gaming video games playstation xbox console steam',
  '🎬': 'movies cinema film theatre tickets netflix stream',
  '🎟️': 'tickets concert event cinema admission pass',
  '🎧': 'headphones audio music podcast beats spotify',
  '🎸': 'guitar music instrument rock band hobby',
  '🎹': 'piano keyboard instrument classical music song',
  '🎨': 'art painting creative craft hobbies draw',
  '🎲': 'board games dice tabletop casino luck',
  '🎳': 'bowling leisure sports games activities',
  '🎤': 'singing karaoke microphone podcast voice',
  '🎯': 'darts archery focus target entertainment goal',

  // Housing & Utilities
  '🏠': 'home house rent mortgage residence property',
  '🏢': 'apartment flat condo building office rent',
  '🛋️': 'furniture couch living sofa interior decor',
  '🧹': 'cleaning housekeeper supplies mop broom tidy',
  '🪴': 'plants garden flowers decor greenery pot',
  '💡': 'electricity bill lighting power utility energy',
  '🚿': 'water shower bathroom plumbing utility bath',
  '🧺': 'laundry washing clothes laundromat detergent',
  '🐾': 'pets veterinary animals supplies paw',
  '🐱': 'cat pet kitten feline vet food',
  '🐶': 'dog pet puppy canine vet food walk',
  '🛌': 'bed bedroom mattress sleep hotel rest',
  '🚪': 'door entrance keys security rent room',
  '🪟': 'window curtains glass repair house frame',
  '🪑': 'chair furniture seating desk dining office',
  '🛁': 'bathtub bath plumbing relaxation wash',
  '🔧': 'wrench maintenance repair handyman tools plumbing',
  '🔨': 'hammer repairs construction carpentry tools',
  '🪛': 'screwdriver tools fixes handyman construction',
  '🧯': 'fire extinguisher safety hazard prevention',
  '🧱': 'bricks construction building remodeling masonry',
  '📡': 'satellite dish internet wifi antenna tv cable',
  '🔌': 'electric plug cord appliance utility bill',
  '🔋': 'battery solar energy power charging backup',
  '💧': 'water utility bill tap plumbing liquid drop',
  '❄️': 'ac air conditioning cooling winter fridge cold',
  '☀️': 'solar heating summer sun electricity warm',
  '📶': 'wifi telecom internet cellular phone network',
  '🗑️': 'garbage trash recycling waste disposal bin',
  '🏡': 'garden cottage house yard home outdoor',
  '🧽': 'sponge cleaning soap wash dishes scrub',

  // Transport & Travel
  '🚌': 'bus transit public commute coach ride',
  '🚕': 'taxi cab uber lyft rideshare transport',
  '🚗': 'car vehicle auto drive motor transit',
  '🚇': 'metro subway underground rail transit train',
  '🚆': 'train rail locomotive express commute trip',
  '✈️': 'flights airplane aviation ticket travel airline',
  '🚲': 'bicycle bike cycling eco commute wheels',
  '🛴': 'scooter electric kick commute transit',
  '⛽': 'fuel petrol gas station diesel charge oil',
  '🅿️': 'parking garage toll meter park fee',
  '🛳️': 'cruise ship vacation sea holiday cruise',
  '🚁': 'helicopter flight air charter transport',
  '🏍️': 'motorbike motorcycle riding bike chopper',
  '🚢': 'ship ferry boat port water maritime',
  '🏎️': 'racing sports car speed luxury drive',
  '🚙': 'suv jeep truck vehicle offroad auto',
  '🚊': 'tram light rail streetcar transit commute',
  '⛵': 'sailboat sailing sea yacht water wind',
  '🚤': 'speedboat boat lake water motor sports',
  '🚀': 'rocket space travel fast launch speed',
  '🚏': 'bus stop station pickup transit shelter',
  '🛣️': 'highway toll road trip expressway freeway',
  '🚥': 'traffic lights signals transport road cross',
  '🎫': 'ticket pass transit rail cinema boarding',
  '🧳': 'luggage suitcase baggage travel trip packing',
  '🛞': 'tires wheels auto repair maintenance car',
  '🗺️': 'map world atlas navigation geography trip',
  '🏝️': 'island tropical vacation paradise beach resort',
  '🏖️': 'beach summer ocean holiday sand seaside',
  '🏨': 'hotel motel lodging resort room booking',
  '🛂': 'passport visa customs immigration travel border',
  '🧭': 'compass navigation orientation travel hike guide',

  // Health, Education & Family
  '💊': 'medicine pharmacy pills prescription drugs pharmacy',
  '🩺': 'stethoscope doctor clinic checkup medical health',
  '🏥': 'hospital clinic emergency surgery healthcare',
  '🩹': 'bandage first aid wound injury patch dressing',
  '💉': 'syringe vaccine injection blood test clinic',
  '🦷': 'dentist tooth dental hygiene braces crown',
  '🏃': 'running workout cardio fitness exercise jogging',
  '💪': 'muscles workout gym fitness strength bicep',
  '🏋️': 'gym weights bodybuilding lifting crossfit fitness',
  '🏊': 'swimming pool water sports laps fitness',
  '🚴': 'cycling bike race exercise workout wheels',
  '🍏': 'nutrition diet healthy food apple green vitamins',
  '🧼': 'soap hygiene clean wash sanitizing disinfectant',
  '🚑': 'ambulance emergency paramedical 911 urgent',
  '🧘': 'yoga meditation mindfulness wellness zen stretch',
  '👶': 'baby infant newborn childcare maternity diaper',
  '🍼': 'baby bottle feeding milk formula nursery infant',
  '🎓': 'graduation degree university college diploma study',
  '📚': 'books library textbook reading studying education',
  '📖': 'book open reading novel studying learn course',
  '✏️': 'pencil stationery drawing write exam notes sketch',
  '📝': 'memo notes exam test clipboard document paper',
  '🔬': 'science laboratory microscope research chemistry biology',
  '💻': 'laptop computer software code tech programming pc',
  '🏫': 'school classroom campus academy tuition academy',
  '🧠': 'brain mental psychology memory learning thought',
  '📁': 'folder office documents filing paperwork archive',
  '🖨️': 'printer printing documents scan copy office ink',
  '📅': 'calendar schedule date appointment diary agenda',
  '🧑‍🧑‍🧒': 'family kids children parenting relatives care',
  '🧸': 'toys teddy bear games children playroom gift',
};

export const EmojiPickerModal: React.FC<EmojiPickerModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  title = 'Choose Icon',
}) => {
  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [customEmojiInput, setCustomEmojiInput] = useState('');
  const [isClosing, setIsClosing] = useState(false);

  const groupKeys = useMemo(() => Object.keys(EMOJI_PICKER_GROUPS), []);

  const handleAnimatedClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
      onClose();
    }, 180);
  };

  // Filtered categorized emojis based on tab + keyword search
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const result: Record<string, string[]> = {};

    for (const [groupName, emojis] of Object.entries(EMOJI_PICKER_GROUPS)) {
      if (activeTab !== 'all' && activeTab !== groupName) {
        continue;
      }

      if (!q) {
        result[groupName] = emojis;
      } else {
        const matching = emojis.filter((emoji) => {
          const keywords = ICON_KEYWORDS[emoji] || '';
          const groupMatch = groupName.toLowerCase().includes(q);
          const keywordMatch = keywords.includes(q);
          return groupMatch || keywordMatch || emoji === q;
        });

        if (matching.length > 0) {
          result[groupName] = matching;
        }
      }
    }

    return result;
  }, [activeTab, searchQuery]);

  const totalMatchingCount = useMemo(() => {
    return Object.values(filteredGroups).reduce((sum, list) => sum + list.length, 0);
  }, [filteredGroups]);

  const handleSelectEmoji = (emoji: string) => {
    onSelect(emoji);
    handleAnimatedClose();
  };

  const handleApplyCustomEmoji = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customEmojiInput.trim();
    if (clean) {
      // Pick first character sequence / emoji
      onSelect(clean);
      setCustomEmojiInput('');
      handleAnimatedClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      onClick={handleAnimatedClose}
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md p-0 sm:p-4 transition-all duration-200 ${
        isClosing ? 'modal-backdrop-closing' : 'modal-backdrop-anim'
      }`}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-lg max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl bg-zinc-950/95 backdrop-blur-2xl border border-zinc-800/80 shadow-2xl overflow-hidden transition-all duration-200 text-white ${
          isClosing ? 'modal-container-closing' : 'modal-container-anim'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-zinc-800/80">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Smile className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
              <p className="text-[11px] text-zinc-400">180+ Categorized Icons & Custom Input</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAnimatedClose}
            className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Search & Filter Bar */}
        <div className="p-4 space-y-3 border-b border-zinc-800/80 bg-zinc-900/30">
          {/* Keyword Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search 180+ icons (e.g. bank, crypto, car, coffee, cat, gym)..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick-Filter Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition cursor-pointer ${
                activeTab === 'all'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
              }`}
            >
              All ({180}+)
            </button>
            {groupKeys.map((group) => {
              const isActive = activeTab === group;
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => setActiveTab(group)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0 transition cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
                  }`}
                >
                  {group}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Icons Grid */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 overscroll-contain">
          {totalMatchingCount === 0 ? (
            <div className="text-center py-10 text-zinc-400 space-y-2">
              <div className="text-3xl">🔍</div>
              <p className="text-sm font-semibold text-white">No icons matched "{searchQuery}"</p>
              <p className="text-xs text-zinc-500">Try typing a keyword or paste any emoji below</p>
            </div>
          ) : (
            Object.entries(filteredGroups).map(([categoryName, emojis]) => (
              <div key={categoryName}>
                <div className="flex items-center justify-between mb-2 px-1">
                  <h4 className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                    {categoryName}
                  </h4>
                  <span className="text-[10px] text-zinc-500 font-mono">{emojis.length}</span>
                </div>
                <div className="grid grid-cols-6 sm:grid-cols-7 gap-2">
                  {emojis.map((emoji, idx) => (
                    <button
                      key={`${categoryName}_${idx}`}
                      type="button"
                      onClick={() => handleSelectEmoji(emoji)}
                      className="h-12 flex items-center justify-center text-2xl rounded-2xl bg-zinc-900/90 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 active:scale-90 transition cursor-pointer shadow-sm group hover:shadow-blue-900/20"
                    >
                      <span className="group-hover:scale-110 transition-transform">{emoji}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Custom Native Emoji Keyboard Input Field */}
        <div className="p-3.5 border-t border-zinc-800/80 bg-zinc-900/50">
          <form onSubmit={handleApplyCustomEmoji} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={customEmojiInput}
                onChange={(e) => setCustomEmojiInput(e.target.value)}
                placeholder="Or paste / type any emoji from your keyboard..."
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={!customEmojiInput.trim()}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-bold transition shadow shrink-0 cursor-pointer"
            >
              Use Custom
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
