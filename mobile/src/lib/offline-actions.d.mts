import type {Trip,User,PendingAction} from './types';
export function operationId():string;
export function projectAction(trips:Trip[],action:PendingAction,user:User):Trip[];
export function projectActions(trips:Trip[],actions:PendingAction[],user:User):Trip[];
