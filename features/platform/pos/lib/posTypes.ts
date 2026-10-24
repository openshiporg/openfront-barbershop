export type PosCustomerSummary = {
  id?: string;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
};

export type PosPackageBalance = {
  id: string;
  remainingVisits?: number | null;
  expiresAt?: string | null;
  servicePackage?: { id: string; name?: string | null } | null;
  membershipPlan?: { id: string; name?: string | null } | null;
};

export type PosAppointment = {
  id: string;
  startsAt?: string | null;
  status?: string | null;
  paymentStatus?: string | null;
  price?: number | null;
  depositAmount?: number | null;
  serviceId?: string | null;
  // Accepted snapshots captured at booking; the ticket identity shown to the operator.
  serviceTitleSnapshot?: string | null;
  barberNameSnapshot?: string | null;
  barberChairNumberSnapshot?: string | null;
  customer?: (PosCustomerSummary & { packageBalances?: PosPackageBalance[] | null }) | null;
};

export type ProductSummary = { id: string; name: string; sku: string; price?: number | null; availableQuantity: number };

export type ProductLineSummary = {
  id: string;
  lineType: string;
  productNameSnapshot: string;
  skuSnapshot?: string | null;
  quantity: number;
  unitPrice: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  returnedQuantity?: number | null;
  occurredAt: string;
  transactionId?: string | null;
  paymentMethod?: string | null;
};

export type ReceiptLine = {
  id: string;
  title: string;
  price: number;
  durationMinutes: number;
  barberName: string;
  barberChairNumber: string;
  packageName: string;
  packageVisitsConsumed?: number | null;
};

export type PosReceipt = {
  id: string;
  status?: string | null;
  subtotal?: number | null;
  tipAmount?: number | null;
  taxAmount?: number | null;
  discountAmount?: number | null;
  total?: number | null;
  paymentMethod?: string | null;
  paymentSessionId?: string | null;
  currencyCode?: string | null;
  completedAt?: string | null;
  customer?: { id: string; firstName?: string | null; lastName?: string | null } | null;
  lineItems: ReceiptLine[];
  cashRefund?: { id: string; amount: number; reason: string; refundedAt: string } | null;
};

export type Paging = { page: number; pageSize: number; total: number };

export type PosProjectionData = {
  timeZone: string;
  appointments: PosAppointment[];
  requestedAppointment: PosAppointment | null;
  requestedAppointmentId: string | null;
  tickets: Paging & { search: string };
  products: ProductSummary[];
  productLines: ProductLineSummary[];
  sales: Paging & { search: string };
  receipts: PosReceipt[];
  receiptPaging: Paging & { receiptId: string };
  metrics: { ready: number; outstanding: number; packageHolders: number; paidToday: number };
};

export type PosLoadResult =
  | { success: true; data: PosProjectionData }
  | { success: false; kind: 'forbidden' | 'unavailable'; error: string };

export type PosCommandResult<T = Record<string, unknown>> = { success: boolean; error: string | null; data: T | null };
