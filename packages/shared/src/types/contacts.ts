// Contact message (admin view)
export interface Contact {
  id: number;
  name: string;
  email: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

// Input for creating a contact message
export interface CreateContactInput {
  name: string;
  email: string;
  message: string;
  turnstileToken: string;
  website?: string; // honeypot field
}
