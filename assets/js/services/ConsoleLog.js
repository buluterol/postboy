/**
 * Console Log
 *
 * In-memory log shown in the Console panel: requests, responses and script
 * output. Callers pass text that is already secret-masked.
 */

import { EventBus } from './EventBus.js';
import { EVENTS } from '../utils/constants.js';

const MAX_ENTRIES = 500;

class ConsoleLogClass {
    constructor() { this.entries = []; }

    /** @param {{kind:'request'|'response'|'script'|'error', level?:string, text:string, detail?:string}} entry */
    add(entry) {
        const full = { time: new Date(), level: 'log', ...entry };
        this.entries.push(full);
        if (this.entries.length > MAX_ENTRIES) this.entries.shift();
        EventBus.emit(EVENTS.CONSOLE_ENTRY, full);
    }

    clear() {
        this.entries = [];
        EventBus.emit(EVENTS.CONSOLE_CLEARED);
    }
}

export const ConsoleLog = new ConsoleLogClass();
