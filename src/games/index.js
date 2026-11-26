// Game registry. Add a game here (and a view in src/ui/views/) to put it in the menu.
import * as pig from './pig.js';
import * as yacht from './yacht.js';
import * as shutbox from './shutbox.js';
import * as cliffhanger from './cliffhanger.js';
import * as salvage from './salvage.js';
import * as plunder from './plunder.js';
import * as dive from './dive.js';
import * as liars from './liars.js';
import * as ship from './ship.js';
import * as highroller from './highroller.js';
import * as martian from './martian.js';
import * as chase from './chase.js';

export const GAMES = { pig, yacht, shutbox, cliffhanger, salvage, plunder, dive, liars, ship, highroller, martian, chase };
export const GAME_ORDER = ['pig', 'yacht', 'shutbox', 'cliffhanger', 'salvage', 'plunder', 'dive', 'liars', 'ship', 'highroller', 'martian', 'chase'];
