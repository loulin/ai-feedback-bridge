// Define types for user feedback requests
export interface UserFeedbackRequest {
  id: string;
  summary: string;
  timestamp: Date;
}

// Define types for user feedback responses
export interface UserFeedbackResponse {
  id: string;
  content: any[];
  timestamp: Date;
}

// Define types for pending requests
export interface PendingRequest {
  resolve: (response: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}
