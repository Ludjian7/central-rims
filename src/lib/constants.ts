// ─── Role Labels ───────────────────────────────────────
export const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  kasir: 'Kasir',
};

// ─── Transaction Status ────────────────────────────────
export const TRANSACTION_STATUS = {
  LUNAS: 'lunas',
  PIUTANG: 'piutang',
  VOID: 'void',
} as const;

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  lunas: 'Lunas',
  piutang: 'Piutang',
  void: 'Void',
};

// ─── Work Order Status ─────────────────────────────────
export const WO_STATUS = {
  MASUK: 'masuk',
  DIKERJAKAN: 'dikerjakan',
  MENUNGGU_PART: 'menunggu_part',
  SELESAI: 'selesai',
  DIAMBIL: 'diambil',
} as const;

export const WO_STATUS_LABELS: Record<string, string> = {
  masuk: 'Masuk',
  dikerjakan: 'Dikerjakan',
  menunggu_part: 'Menunggu Part',
  selesai: 'Selesai',
  diambil: 'Diambil',
};

// ─── Payment Methods ───────────────────────────────────
export const PAYMENT_METHODS = {
  CASH: 'cash',
  TRANSFER: 'transfer',
} as const;

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  transfer: 'Transfer',
};

// ─── Stock Movement Types ──────────────────────────────
export const STOCK_MOVEMENT_TYPE = {
  IN: 'in',
  OUT: 'out',
  ADJUSTMENT: 'adjustment',
} as const;

// ─── PO Status ─────────────────────────────────────────
export const PO_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PARTIAL: 'partial',
  COMPLETED: 'completed',
} as const;

export const PO_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Dikirim',
  partial: 'Diterima Sebagian',
  completed: 'Selesai',
};

// ─── Receivable Status ─────────────────────────────────
export const RECEIVABLE_STATUS = {
  OPEN: 'open',
  PARTIAL: 'partial',
  PAID: 'paid',
} as const;

export const RECEIVABLE_STATUS_LABELS: Record<string, string> = {
  open: 'Belum Bayar',
  partial: 'Sebagian',
  paid: 'Lunas',
};

// ─── Commission Status ─────────────────────────────────
export const COMMISSION_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  PAID: 'paid',
} as const;

export const COMMISSION_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  paid: 'Paid',
};

// ─── Customer Types ────────────────────────────────────
export const CUSTOMER_TYPES = {
  RETAIL: 'retail',
  MEMBER: 'member',
} as const;
