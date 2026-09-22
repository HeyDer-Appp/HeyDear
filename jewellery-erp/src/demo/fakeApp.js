// Demo-mode stand-in for firebase/app.
export const initializeApp = (config, name = '[DEFAULT]') => ({ name, options: config });
export const deleteApp = async () => {};
