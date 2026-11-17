import { pick, type Rng, defaultRng } from './rng';

const NAMES = [
  'Bubbles', 'Pip', 'Marlo', 'Gill', 'Coral', 'Splash', 'Wiggles', 'Zephyr', 'Biscuit', 'Mochi',
  'Pebble', 'Noodle', 'Kiwi', 'Tofu', 'Ziggy', 'Luna', 'Comet', 'Nova', 'Orbit', 'Pixel',
  'Byte', 'Glimmer', 'Puddle', 'Squish', 'Ripple', 'Sprocket', 'Fig', 'Olive', 'Juniper', 'Basil',
  'Waffles', 'Captain', 'Doodle', 'Sushi', 'Beans', 'Pickle', 'Mango', 'Sunny', 'Echo', 'Quasar',
  'Nebby', 'Twinkle', 'Fizz', 'Blip', 'Dot', 'Taco', 'Peaches', 'Sprinkle', 'Wobble', 'Gus',
  'Hazel', 'Kip', 'Lumen', 'Mars', 'Nimbus', 'Opal', 'Pocket', 'Rumi', 'Sage', 'Tidbit',
];

export function randomFishName(rng: Rng = defaultRng): string {
  return pick(NAMES, rng);
}
