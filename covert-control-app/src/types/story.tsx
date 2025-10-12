export interface Story {
  id: string;
  title: string;
  description?: string;
  content?: string;
  ownerId: string;
  viewCount?: number;
  username: string;
  likesCount?: number;
  createdAt?: Date; // or Firebase Timestamp if you prefer
}