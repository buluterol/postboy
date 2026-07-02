/**
 * Resize Manager
 * 
 * Handles panel resizing with draggable dividers
 */

export class ResizeManager {
    constructor() {
        this.isResizing = false;
        this.currentResizer = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;

        this.init();
    }

    init() {
        this.setupVerticalResizer();
        this.setupHorizontalResizer();
        this.loadSavedSizes();
    }

    setupVerticalResizer() {
        const resizer = document.getElementById('verticalResizer');
        const sidebar = document.querySelector('.sidebar');

        if (!resizer || !sidebar) return;

        resizer.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            this.currentResizer = 'vertical';
            this.startX = e.clientX;
            this.startWidth = sidebar.offsetWidth;

            resizer.classList.add('resizing');
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';

            e.preventDefault();
        });
    }

    setupHorizontalResizer() {
        const resizer = document.getElementById('horizontalResizer');
        const requestPanel = document.querySelector('.request-panel');

        if (!resizer || !requestPanel) return;

        resizer.addEventListener('mousedown', (e) => {
            this.isResizing = true;
            this.currentResizer = 'horizontal';
            this.startY = e.clientY;
            this.startHeight = requestPanel.offsetHeight;

            resizer.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';

            e.preventDefault();
        });
    }

    startListening() {
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    }

    handleMouseMove(e) {
        if (!this.isResizing) return;

        if (this.currentResizer === 'vertical') {
            const sidebar = document.querySelector('.sidebar');
            if (!sidebar) return;

            const deltaX = e.clientX - this.startX;
            const newWidth = this.startWidth + deltaX;

            // Min and max width constraints
            const minWidth = 200;
            const maxWidth = 600;

            if (newWidth >= minWidth && newWidth <= maxWidth) {
                sidebar.style.width = `${newWidth}px`;
            }
        } else if (this.currentResizer === 'horizontal') {
            const requestPanel = document.querySelector('.request-panel');
            if (!requestPanel) return;

            const deltaY = e.clientY - this.startY;
            const newHeight = this.startHeight + deltaY;

            // Min height constraint
            const minHeight = 200;
            const mainContent = document.querySelector('.main-content');
            const maxHeight = mainContent ? mainContent.offsetHeight - 250 : 9999;

            if (newHeight >= minHeight && newHeight <= maxHeight) {
                requestPanel.style.height = `${newHeight}px`;
            }
        }
    }

    handleMouseUp() {
        if (!this.isResizing) return;

        this.isResizing = false;

        // Remove resizing class
        const verticalResizer = document.getElementById('verticalResizer');
        const horizontalResizer = document.getElementById('horizontalResizer');

        if (verticalResizer) verticalResizer.classList.remove('resizing');
        if (horizontalResizer) horizontalResizer.classList.remove('resizing');

        // Reset cursor
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // Save sizes to localStorage
        this.saveSizes();

        this.currentResizer = null;
    }

    saveSizes() {
        const sidebar = document.querySelector('.sidebar');
        const requestPanel = document.querySelector('.request-panel');

        if (sidebar) {
            localStorage.setItem('sidebarWidth', sidebar.offsetWidth);
        }

        if (requestPanel) {
            localStorage.setItem('requestPanelHeight', requestPanel.offsetHeight);
        }
    }

    loadSavedSizes() {
        const sidebarWidth = localStorage.getItem('sidebarWidth');
        const requestPanelHeight = localStorage.getItem('requestPanelHeight');

        if (sidebarWidth) {
            const sidebar = document.querySelector('.sidebar');
            if (sidebar) {
                sidebar.style.width = `${sidebarWidth}px`;
            }
        }

        if (requestPanelHeight) {
            const requestPanel = document.querySelector('.request-panel');
            if (requestPanel) {
                requestPanel.style.height = `${requestPanelHeight}px`;
            }
        }
    }
}
