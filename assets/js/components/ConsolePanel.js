/**
 * Console Panel
 *
 * Bottom panel listing ConsoleLog entries (requests, responses, script output).
 * Entries are rendered with textContent, so logged text can never inject HTML.
 */

import { EVENTS } from '../utils/constants.js';
import { EventBus } from '../services/EventBus.js';
import { ConsoleLog } from '../services/ConsoleLog.js';

const LEVEL_CLASS = {
    log: 'text-gray-700 dark:text-gray-300',
    info: 'text-blue-600 dark:text-blue-400',
    warn: 'text-yellow-600 dark:text-yellow-400',
    error: 'text-red-600 dark:text-red-400'
};

export class ConsolePanel {
    constructor() {
        this.button = document.getElementById('consoleBtn');
        this.panel = document.createElement('div');
        this.panel.id = 'consolePanel';
        this.panel.className = 'hidden mt-2 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 flex flex-col';
        this.panel.style.height = '200px';
        this.panel.innerHTML = `
            <div class="flex items-center justify-between px-3 py-1 border-b border-gray-200 dark:border-gray-700 text-sm font-semibold">
                <span>Console</span>
                <button id="consoleClearBtn" class="btn btn-secondary btn-sm">Clear</button>
            </div>
            <div id="consoleList" class="flex-1 overflow-y-auto font-mono text-xs p-2 scrollbar-thin"></div>`;
        document.querySelector('.main-content')?.appendChild(this.panel);
        this.list = this.panel.querySelector('#consoleList');

        this.button?.addEventListener('click', () => this.toggle());
        this.panel.querySelector('#consoleClearBtn').addEventListener('click', () => ConsoleLog.clear());
        EventBus.on(EVENTS.CONSOLE_ENTRY, entry => this.append(entry));
        EventBus.on(EVENTS.CONSOLE_CLEARED, () => { this.list.textContent = ''; });
        ConsoleLog.entries.forEach(e => this.append(e));
    }

    toggle() {
        this.panel.classList.toggle('hidden');
        if (!this.panel.classList.contains('hidden')) this.list.scrollTop = this.list.scrollHeight;
    }

    append(entry) {
        const row = document.createElement('div');
        row.className = `py-0.5 ${LEVEL_CLASS[entry.level] || LEVEL_CLASS.log}`;
        const time = entry.time instanceof Date ? entry.time.toLocaleTimeString() : '';
        const head = document.createElement('div');
        head.textContent = `${time} [${entry.kind}] ${entry.text}`;
        row.appendChild(head);
        if (entry.detail) {
            head.classList.add('cursor-pointer');
            const detail = document.createElement('pre');
            detail.className = 'hidden whitespace-pre-wrap pl-4 opacity-80';
            detail.textContent = entry.detail;
            row.appendChild(detail);
            head.addEventListener('click', () => detail.classList.toggle('hidden'));
        }
        this.list.appendChild(row);
        this.list.scrollTop = this.list.scrollHeight;
    }
}
