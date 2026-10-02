export const SHORTCODES = {
  smile: '😄', grin: '😁', joy: '😂', lol: '😂', wink: '😉', heart: '❤️', fire: '🔥', thumbsup: '👍', '+1': '👍', '-1': '👎', clap: '👏',
  tada: '🎉', party: '🥳', rocket: '🚀', eyes: '👀', pray: '🙏', thinking: '🤔', cry: '😢', sob: '😭', angry: '😡', cool: '😎', sleepy: '😴',
  check: '✅', x: '❌', warning: '⚠️', star: '⭐', sparkles: '✨', bulb: '💡', coffee: '☕', pizza: '🍕', cake: '🎂', muscle: '💪', wave: '👋',
  ok: '👌', '100': '💯', skull: '💀', bug: '🐛', zap: '⚡', pin: '📌', memo: '📝', hourglass: '⏳', rainbow: '🌈', sun: '☀️', moon: '🌙',
};
export const expandShortcodes = (t = '') => t.replace(/:([a-z0-9_+-]+):/g, (m, k) => SHORTCODES[k] || m);
