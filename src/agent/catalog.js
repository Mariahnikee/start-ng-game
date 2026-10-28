// Sample building blocks the demo copilot picks from. Everything here is
// deterministic: the same idea always produces the same plan.

export const GENRES = {
  catch: {
    label: 'Catch & collect',
    keywords: ['catch', 'collect', 'grab', 'basket', 'falling', 'fall', 'rain', 'gather', 'pick'],
    categories: ['catch-and-dodge', 'coin-collecting'],
    loop: 'Slide left and right to catch the good things falling from the sky. Touching the bad ones costs a life.',
    controls: ['← → or A / D to move', 'On a phone: drag or tap where you want to go'],
    mechanics: [
      'Good items fall from the top: catch them for +1 point',
      'Bad items fall too: touching one costs a life',
      'Things fall a little faster every few seconds',
      'Short flash of safety after you get hit',
    ],
  },
  dodge: {
    label: 'Dodge & survive',
    keywords: ['dodge', 'avoid', 'survive', 'traffic', 'okada', 'danfo', 'escape', 'weave', 'hide'],
    categories: ['catch-and-dodge', 'survival'],
    loop: 'Weave left and right to stay clear of everything coming at you. The longer you last, the higher your score.',
    controls: ['← → or A / D to move', 'On a phone: drag or tap where you want to go'],
    mechanics: [
      'Obstacles rush down the screen: touching one costs a life',
      'You score points just for staying alive',
      'Grab the bonus items for +5 points',
      'The rush gets faster the longer you survive',
    ],
  },
  runner: {
    label: 'Endless runner',
    keywords: ['run', 'runner', 'jump', 'endless', 'chase', 'hop', 'sprint', 'race', 'dash'],
    categories: ['endless-runners'],
    loop: 'Your hero runs on their own. Jump over obstacles and grab bonuses in mid-air for as long as you can.',
    controls: ['Space, ↑ or W to jump', 'On a phone: tap anywhere to jump'],
    mechanics: [
      'Obstacles slide in from the right: jump them or lose a life',
      'Bonus items float in the air for +3 points',
      'Distance counts as points too',
      'The world speeds up as you go',
    ],
  },
  shooter: {
    label: 'Blaster',
    keywords: ['shoot', 'shooter', 'blast', 'laser', 'alien', 'invader', 'defend', 'defence', 'defense', 'fire', 'zap'],
    categories: ['shooting-and-action'],
    loop: 'Your blaster fires on its own. Slide left and right to hit the invaders before they reach the ground.',
    controls: ['← → or A / D to move (you fire automatically)', 'On a phone: drag or tap where you want to go'],
    mechanics: [
      'Invaders fall from the top: blast them for +1 point',
      'An invader that lands or hits you costs a life',
      'Catch the bonus items for +3 points',
      'Waves come faster over time',
    ],
  },
};

export const THEMES = {
  market: {
    label: 'Lagos market',
    keywords: ['market', 'lagos', 'naija', 'nigeria', 'nigerian', 'mama', 'trader', 'tomato', 'pepper', 'oja', 'balogun', 'mango'],
    player: '🧺',
    good: ['🍅', '🌶️', '🥭', '🍌'],
    bad: ['🪨', '🐐'],
    sky: ['#fff4c9', '#ffd27a'],
    ground: '#b5652a',
    dark: false,
    words: { catch: 'Market Catch', dodge: 'Market Madness', runner: 'Market Dash', shooter: 'Market Defenders' },
    categories: ['nigerian-themed', 'markets-and-street-life'],
  },
  food: {
    label: 'Jollof kitchen',
    keywords: ['jollof', 'food', 'cook', 'cooking', 'kitchen', 'suya', 'puff', 'chef', 'rice', 'soup', 'eat', 'snack'],
    player: '🍲',
    good: ['🍛', '🍗', '🌶️', '🧅'],
    bad: ['🔥', '🪳'],
    sky: ['#fff1e0', '#ffb38a'],
    ground: '#8a3b12',
    dark: false,
    words: { catch: 'Jollof Catch', dodge: 'Kitchen Chaos', runner: 'Suya Sprint', shooter: 'Pepper Blaster' },
    categories: ['food-and-cooking', 'nigerian-themed'],
  },
  road: {
    label: 'Lagos traffic',
    keywords: ['traffic', 'road', 'danfo', 'okada', 'keke', 'bus', 'car', 'drive', 'driving', 'go-slow', 'bike'],
    player: '🛵',
    good: ['🪙', '⛽'],
    bad: ['🚌', '🚗', '🚧'],
    sky: ['#e3f1ff', '#9cc9ff'],
    ground: '#4a4b41',
    dark: false,
    words: { catch: 'Fuel Catch', dodge: 'Go-Slow Dodge', runner: 'Okada Run', shooter: 'Traffic Blaster' },
    categories: ['lagos', 'nigerian-themed', 'racing-and-driving'],
  },
  space: {
    label: 'Outer space',
    keywords: ['space', 'star', 'stars', 'alien', 'planet', 'galaxy', 'rocket', 'moon', 'cosmic', 'astronaut', 'ufo'],
    player: '🚀',
    good: ['⭐', '🪐', '💎'],
    bad: ['☄️', '👾'],
    sky: ['#17153a', '#3b2a6b'],
    ground: '#2a2550',
    dark: true,
    words: { catch: 'Star Catcher', dodge: 'Comet Dodge', runner: 'Moon Hop', shooter: 'Cosmic Blaster' },
    categories: ['space-and-sci-fi'],
  },
  neon: {
    label: 'Neon city',
    keywords: ['neon', 'cyber', 'cyberpunk', 'robot', 'glow', 'synth', 'arcade', 'retro', 'pixel', 'hacker', 'code'],
    player: '🤖',
    good: ['💠', '⚡'],
    bad: ['🔻', '💣'],
    sky: ['#120b24', '#2b0f3d'],
    ground: '#d8fd71',
    dark: true,
    words: { catch: 'Neon Catch', dodge: 'Glitch Dodge', runner: 'Neon Dash', shooter: 'Byte Blaster' },
    categories: ['neon-and-cyberpunk'],
  },
  party: {
    label: 'Owambe party',
    keywords: ['party', 'owambe', 'dance', 'wedding', 'music', 'celebrate', 'celebration', 'birthday', 'festival'],
    player: '💃',
    good: ['🎁', '🥤', '🎶'],
    bad: ['💦', '🪨'],
    sky: ['#fde7f3', '#f9b6d6'],
    ground: '#7a2d5a',
    dark: false,
    words: { catch: 'Owambe Catch', dodge: 'Owambe Dodge', runner: 'Owambe Dash', shooter: 'Party Popper' },
    categories: ['nigerian-themed', 'five-minute-fun'],
  },
};

export const DEFAULT_THEME = 'party';
export const DEFAULT_GENRE = 'catch';

export const SIZES = { small: 30, normal: 42, big: 56 };

export const LIMITS = {
  speed: { min: 1, max: 5 },
  lives: { min: 1, max: 9 },
};

// Codes start.ng refuses as game names (from start.ng/docs.md).
export const RESERVED_NAMES = ['api', 'auth', 'login', 'www', '3rdmainland'];
