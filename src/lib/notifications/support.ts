export function notificationsSupported(): boolean {
    return typeof window !== "undefined" && "Notification" in window;
}

export function getPermission(): NotificationPermission | "unsupported" {
    return notificationsSupported() ? window.Notification.permission : "unsupported";
}

export async function askPermission(): Promise<NotificationPermission | "unsupported"> {
    if (!notificationsSupported()) return "unsupported";
    return window.Notification.requestPermission();
}