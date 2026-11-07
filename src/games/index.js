// Game registry. Add a game here (and a view in src/ui/views/) to put it in the menu.
import * as pig from './pig.js';
import * as farkle from './farkle.js';
import * as yacht from './yacht.js';
import * as shutbox from './shutbox.js';
import * as cliffhanger from './cliffhanger.js';

export const GAMES = { pig, farkle, yacht, shutbox, cliffhanger };
export const GAME_ORDER = ['pig', 'farkle', 'yacht', 'shutbox', 'cliffhanger'];
