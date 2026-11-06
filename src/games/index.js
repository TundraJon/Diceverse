// Game registry. Add a game here (and a view in src/ui/views/) to put it in the menu.
import * as pig from './pig.js';
import * as farkle from './farkle.js';

export const GAMES = { pig, farkle };
export const GAME_ORDER = ['pig', 'farkle'];
