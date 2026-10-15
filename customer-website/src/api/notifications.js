export const notificationUtil = {
    requestPermission: async () => {
        if (!("Notification" in window)) {
            console.log("This browser does not support desktop notification");
            return false;
        }

        if (Notification.permission === "granted") return true;

        const permission = await Notification.requestPermission();
        return permission === "granted";
    },

    show: (title, body) => {
        if (Notification.permission === "granted") {
            new Notification(title, {
                body,
                icon: '/vite.svg', // logo path
            });
        }
    }
};
