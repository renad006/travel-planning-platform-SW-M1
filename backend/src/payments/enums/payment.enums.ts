export enum BookingType {
  FLIGHT = 'flight',
  HOTEL = 'hotel',
}

export enum PaymentStatus {
  PENDING = 'pending',
  SUCCEEDED = 'succeeded',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  PARTIALLY_REFUNDED = 'partially_refunded',
  REFUNDED = 'refunded',
}

export enum RefundStatus {
  PENDING = 'pending',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}