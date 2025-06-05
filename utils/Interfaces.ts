export enum Role {
  User = 0,
  Bot = 1,
}

export interface Message {
  id?: string; // Optional ID for client-side message tracking
  role: Role;
  content: string;
  imageUrl?: string;
  prompt?: string;
}

export interface Chat {
  id: number;
  title: string;
}
