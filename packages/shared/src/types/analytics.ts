// Analytics summary for admin dashboard
export interface AnalyticsSummary {
  /** Total pageviews for the requested date range (field name matches backend response). */
  pageviews: number;
  pendingComments: number;
  publishedPosts: number;
  publishedProjects: number;
}

// Top post by pageviews
export interface TopPost {
  path: string;
  views: number;
}
