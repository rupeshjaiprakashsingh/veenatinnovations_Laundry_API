export interface CompletedPaymentRecord {
  amount: number;
  paymentMode?: string | null;
  paymentStatus?: string | null;
}

export function getCreditsAppliedFromNotes(notes?: string | null, fullCoverageAmount = 0): number {
  if (!notes) return 0;

  const match = notes.match(/Grivana Credits Applied:\s*Rs\.?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (match) {
    const amount = Number.parseFloat(match[1].replace(/,/g, ''));
    return Number.isFinite(amount) && amount > 0 ? amount : 0;
  }

  return /Grivana Credits \(100% Covered\)|Payment Mode:\s*Grivana Credits/i.test(notes)
    ? Math.max(0, fullCoverageAmount)
    : 0;
}

export function getTotalPaidIncludingCredits(
  notes: string | null | undefined,
  payments: CompletedPaymentRecord[] = [],
  fullCoverageAmount = 0,
): number {
  const completed = payments.filter(payment => payment.paymentStatus?.toLowerCase() === 'completed');
  const paymentTotal = completed.reduce((sum, payment) => sum + payment.amount, 0);
  const hasCreditPayment = completed.some(payment => /grivana credits/i.test(payment.paymentMode || ''));

  return paymentTotal + (hasCreditPayment ? 0 : getCreditsAppliedFromNotes(notes, fullCoverageAmount));
}

export function getPaymentStatusForTotal(netAmount: number, totalPaid: number): string {
  if (totalPaid >= netAmount) return 'Paid';
  return totalPaid > 0 ? 'Partially Paid' : 'Pending';
}