// js/notifications.js
class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Criar container de notificações se não existir
        if (!document.getElementById('notifications-container')) {
            this.container = document.createElement('div');
            this.container.id = 'notifications-container';
            this.container.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                max-width: 400px;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('notifications-container');
        }
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `custom-notification ${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${icons[type] || icons.info}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        this.container.appendChild(notification);

        // Animação de entrada
        setTimeout(() => {
            notification.classList.add('show');
        }, 10);

        // Auto-remover após duração
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.classList.remove('show');
                    setTimeout(() => {
                        if (notification.parentElement) {
                            notification.remove();
                        }
                    }, 300);
                }
            }, duration);
        }

        return notification;
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 5000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }

    // Método global para compatibilidade
    static show(message, type = 'info', duration = 5000) {
        if (!window.notificationManager) {
            window.notificationManager = new NotificationManager();
        }
        return window.notificationManager.show(message, type, duration);
    }

    static success(message, duration = 5000) {
        if (!window.notificationManager) {
            window.notificationManager = new NotificationManager();
        }
        return window.notificationManager.success(message, duration);
    }

    static error(message, duration = 5000) {
        if (!window.notificationManager) {
            window.notificationManager = new NotificationManager();
        }
        return window.notificationManager.error(message, duration);
    }

    static warning(message, duration = 5000) {
        if (!window.notificationManager) {
            window.notificationManager = new NotificationManager();
        }
        return window.notificationManager.warning(message, duration);
    }

    static info(message, duration = 5000) {
        if (!window.notificationManager) {
            window.notificationManager = new NotificationManager();
        }
        return window.notificationManager.info(message, duration);
    }
}

// Funções globais para compatibilidade
function showNotification(message, type = 'info', duration = 5000) {
    return NotificationManager.show(message, type, duration);
}

function showSuccess(message, duration = 5000) {
    return NotificationManager.success(message, duration);
}

function showError(message, duration = 5000) {
    return NotificationManager.error(message, duration);
}

function showWarning(message, duration = 5000) {
    return NotificationManager.warning(message, duration);
}

function showInfo(message, duration = 5000) {
    return NotificationManager.info(message, duration);
}

// Inicializar automaticamente
document.addEventListener('DOMContentLoaded', function() {
    window.notificationManager = new NotificationManager();
});

// Instância global
const notificationManager = new NotificationManager();