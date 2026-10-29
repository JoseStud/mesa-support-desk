export type RequestStatus = 'new' | 'in_progress' | 'resolved';
export type Priority = 'low' | 'normal' | 'urgent';
export type Category = 'access' | 'software' | 'billing' | 'other';

export interface Activity {
  id: string;
  kind: 'created' | 'status' | 'comment' | 'priority';
  text: string;
  at: string;
}

export interface SupportRequest {
  id: string;
  title: string;
  description: string;
  customer: string;
  category: Category;
  priority: Priority;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  resolution: string | null;
  activity: Activity[];
}

export interface CreateInput {
  title: string;
  description: string;
  customer: string;
  category: Category;
  priority: Priority;
}

export interface RequestFilters {
  query: string;
  status: RequestStatus | 'all';
  priority: Priority | 'all';
  category: Category | 'all';
  sort: 'newest' | 'oldest' | 'priority';
  openOnly?: boolean;
  overdueOnly?: boolean;
}
