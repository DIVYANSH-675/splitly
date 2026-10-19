import { balances, settlements, expenseFromInput, minor } from './finance.mjs';
export const operationId = () => `op_${Date.now()}_${Math.random().toString(36).slice(2, 14)}`;
export function projectAction(trips, action, user) {
  const { path, method, body = {} } = action;
  const parts = path.split('/').filter(Boolean);
  if (path === '/trips' && method === 'POST') {
    if (trips.some((t) => t.id === body.id)) return trips;
    const members = [
      { id: body.me, name: user.name, linked: true },
      ...(body.guests || []).map((name, i) => ({ id: body.memberIds[i], name, linked: false })),
    ];
    return [
      {
        id: body.id,
        code: '',
        name: body.name,
        currency: body.currency,
        me: body.me,
        ownerId: user.id,
        isOwner: true,
        members,
        expenses: [],
        transfers: [],
        activity: [],
        balances: members.map((m) => ({ ...m, paid: 0, spent: 0, balance: 0 })),
        settlements: [],
        total: 0,
        version: 0,
        updatedAt: action.createdAt,
        localOnly: true,
      },
      ...trips,
    ];
  }
  if (parts[0] !== 'trips') return trips;
  const found = trips.find((t) => t.id === parts[1]);
  if (!found) throw new Error('Open this group while online before editing it offline.');
  const trip = JSON.parse(JSON.stringify(found));
  trip.localOnly = true;
  if (!parts[2]) {
    if (method === 'DELETE') return trips.filter((t) => t.id !== trip.id);
    trip.name = body.name ?? trip.name;
  } else if (parts[2] === 'categories') {
    trip.categories = [...new Set([...(trip.categories || []), body.name])];
  } else if (parts[2] === 'members') {
    if (method === 'POST') trip.members.push({ id: body.id, name: body.name, linked: false });
    else if (method === 'PATCH') {
      const member = trip.members.find((m) => m.id === parts[3]);
      if (member) member.name = body.name;
    } else {
      if (
        trip.expenses.some((e) =>
          [...e.shares, ...e.payers].some((m) => m.memberId === parts[3]),
        ) ||
        trip.transfers.some((t) => t.from === parts[3] || t.to === parts[3])
      )
        throw new Error('A member with transactions must stay in the ledger.');
      trip.members = trip.members.filter((m) => m.id !== parts[3]);
    }
  } else if (parts[2] === 'transfers') {
    if (method === 'DELETE') trip.transfers = trip.transfers.filter((t) => t.id !== parts[3]);
    else {
      if (
        body.from === body.to ||
        !trip.members.some((m) => m.id === body.from) ||
        !trip.members.some((m) => m.id === body.to)
      )
        throw new Error('Choose two group members.');
      const old = trip.transfers.find((t) => t.id === parts[3]);
      const entry = {
        ...body,
        id: old?.id || body.id,
        createdBy: old?.createdBy || user.id,
        amount: minor(body.amount, trip.currency),
        createdAt: old?.createdAt || action.createdAt,
      };
      trip.transfers = [...trip.transfers.filter((t) => t.id !== entry.id), entry];
    }
  } else if (parts[2] === 'expenses') {
    if (method === 'DELETE') trip.expenses = trip.expenses.filter((e) => e.id !== parts[3]);
    else {
      const old = trip.expenses.find((e) => e.id === parts[3]);
      const entry = {
        ...body,
        ...expenseFromInput(body, trip),
        id: old?.id || body.id,
        createdBy: old?.createdBy || user.id,
        createdAt: old?.createdAt || action.createdAt,
      };
      trip.expenses = [...trip.expenses.filter((e) => e.id !== entry.id), entry];
    }
  }
  trip.total = trip.expenses.reduce((sum, e) => sum + e.amount, 0);
  trip.balances = balances(trip);
  trip.settlements = settlements(trip);
  return [trip, ...trips.filter((t) => t.id !== trip.id)];
}
export function projectActions(trips, actions, user) {
  return actions.reduce((current, action) => {
    try {
      return projectAction(current, action, user);
    } catch {
      return current;
    }
  }, trips);
}
