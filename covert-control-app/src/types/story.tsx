export interface Story {
  id: string;
  title: string;
  description?: string;
  content?: string;
  ownerId: string;
  viewCount?: number;
  username: string;
  likesCount?: number;
  createdAt: Date | null;
  updatedAt?: Date | null;
  chapterCount?: number;
  tags?: string[]; 
}