export interface UserProfile {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
  followers: string[]; // Array of UIDs
  following: string[]; // Array of UIDs
  bio?: string;
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null; // For nested replies
  uid: string;
  authorName: string;
  authorPhoto: string | null;
  text: string;
  createdAt: number;
}

export interface Post {
  id: string;
  uid: string;
  authorName: string;
  authorPhoto: string | null;
  bookTitle: string;
  bookAuthor: string;
  coverImage: string; // URL
  quote: string;
  review: string;
  rating: number; // 1-5
  likes: string[]; // Array of UIDs who liked
  createdAt: number;
  commentCount: number;
}

export enum FeedType {
  GLOBAL = 'GLOBAL',
  FOLLOWING = 'FOLLOWING'
}
