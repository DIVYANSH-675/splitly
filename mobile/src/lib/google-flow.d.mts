export type GooglePending = {verifier:string;state:string;redirect:string;apiUrl:string;createdAt:number;link:boolean};
export function googleAuthorizeUrl(authorizeUrl:string,redirect:string,state:string,challenge:string):string;
export function googleCallback(url:string,pending:GooglePending|null,apiUrl:string,now?:number):{code:string;verifier:string};
