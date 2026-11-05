import type { PlanId } from '../../protocol/src/index';

// TODO(M5): the enforcement layer. Called from HTTP *and* WS handlers.
//   canCreateRoom(userId) / canAddCollaborator(roomId, userId) / canExport(userId)
// This is where "paywall as UI" becomes "paywall as enforcement".
export function planLimits(plan: PlanId) {
  return plan === 'pro'
    ? { maxRooms: Infinity, maxCollaborators: Infinity }
    : { maxRooms: 1, maxCollaborators: 3 };
}
