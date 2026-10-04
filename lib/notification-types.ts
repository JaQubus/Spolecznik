/** Wspólne dla serwera i przeglądarki: kanały sygnału „jest nowe powiadomienie” i kształt odpowiedzi /api/powiadomienia. */

export const NOTIFICATION_EVENT = "nowe-powiadomienie";
export const ADMIN_CHANNEL = "powiadomienia:admin";
export const userChannel = (userId: string) => `powiadomienia:${userId}`;
/** Ekspert bez konta (ekspert demo albo konto testowe) dostaje powiadomienia po swoim id z indeksu ekspertów. */
export const expertRole = (expertId: string) => `ekspert:${expertId}` as const;
export const expertChannel = (expertId: string) => `powiadomienia:ekspert:${expertId}`;

export type NotificationItem = {
  id: string;
  text: string;
  href: string | null;
  createdAt: string;
  unread: boolean;
};

export type NotificationsResponse =
  | { enabled: false }
  | { enabled: true; items: NotificationItem[]; unread: number; channels: string[] };
