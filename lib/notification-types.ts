/** Wspólne dla serwera i przeglądarki: kanały sygnału „jest nowe powiadomienie” i kształt odpowiedzi /api/notifications. */

export const NOTIFICATION_EVENT = "nowe-powiadomienie";
export const ADMIN_CHANNEL = "powiadomienia:admin";
export const userChannel = (userId: string) => `powiadomienia:${userId}`;
/** Mentor bez konta (mentor demo albo konto testowe) dostaje powiadomienia po swoim id z tabeli mentors. */
export const mentorRole = (mentorId: string) => `mentor:${mentorId}` as const;
export const mentorChannel = (mentorId: string) => `powiadomienia:mentor:${mentorId}`;

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
