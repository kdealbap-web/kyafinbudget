export enum WeddingExpenseAttachmentType {
  Quote = 'quote',
  Invoice = 'invoice',
  Receipt = 'receipt',
  Contract = 'contract',
  Other = 'other',
}

export interface WeddingExpenseAttachment {
  id: string;
  expense_id: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_path: string;
  attachment_type: WeddingExpenseAttachmentType;
  uploaded_at?: string;
  uploaded_by: string;
}
