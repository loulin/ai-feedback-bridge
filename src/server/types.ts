// 定义用户反馈请求的类型
export interface UserFeedbackRequest {
  id: string;
  summary: string;
  timestamp: Date;
}

// 定义用户反馈响应的类型
export interface UserFeedbackResponse {
  id: string;
  content: any[];
  timestamp: Date;
}

// 定义pending request类型
export interface PendingRequest {
  resolve: (response: any) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}
