// Every network entry point uses this same switch, including downloads.
let session = null;
export const setLocalSession = (value) => { session = value; };
export const getLocalSession = () => session;
