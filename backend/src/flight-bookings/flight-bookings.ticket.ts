import { DateTime } from 'luxon';
import PDFDocument from 'pdfkit';
import { BookingView } from './flight-bookings.view';

/** "Fri 20 Dec 2026, 10:30 (Africa/Cairo)" from an ISO string that already carries the offset. */
function formatLocal(iso: string, timeZone: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true });
  return `${dt.toFormat('ccc dd LLL yyyy, HH:mm')} (${timeZone})`;
}

/**
 * FLT-23: the downloadable e-ticket. Times are shown in each airport's local time (GEN-06).
 * Returns a PDFKit document; the caller pipes it to the response and calls `end()`.
 */
export function renderETicket(
  booking: BookingView,
  airlineByFlight: Record<string, string>,
): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `E-Ticket ${booking.reference}`,
      Author: 'Travel Planning and Booking Platform',
    },
  });

  // ---- header ----
  doc.fontSize(24).font('Helvetica-Bold').text('E-TICKET');
  doc.moveDown(0.2).fontSize(10).font('Helvetica').fillColor('#555555');
  doc.text('Travel Planning and Booking Platform');
  doc.fillColor('#000000').moveDown(1);

  doc
    .fontSize(12)
    .font('Helvetica-Bold')
    .text(`Booking reference: ${booking.reference}`);
  doc.font('Helvetica').text(`E-ticket number: ${booking.eTicketNumber}`);
  doc.text(`Status: ${booking.status}`);
  doc.text(
    `Trip: ${booking.tripType === 'round_trip' ? 'Round trip' : 'One way'}`,
  );
  doc.moveDown(1);

  // ---- flights ----
  doc.fontSize(14).font('Helvetica-Bold').text('Flights');
  doc.moveDown(0.4);
  for (const segment of booking.segments) {
    const title = segment.direction === 'return' ? 'Return' : 'Outbound';
    const airline = airlineByFlight[segment.flightId] ?? 'Airline';
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text(
        `${title}: ${segment.flightNumber} - ${airline} - ${segment.cabinClass}`,
      );
    doc.font('Helvetica').fontSize(11);
    doc.text(
      `From: ${segment.origin.iataCode}${segment.origin.name ? ` (${segment.origin.name})` : ''}`,
    );
    doc.text(
      `Departs: ${formatLocal(segment.departureLocal, segment.origin.timeZone)}`,
    );
    doc.text(
      `To: ${segment.destination.iataCode}${segment.destination.name ? ` (${segment.destination.name})` : ''}`,
    );
    doc.text(
      `Arrives: ${formatLocal(segment.arrivalLocal, segment.destination.timeZone)}`,
    );
    const hours = Math.floor(segment.durationMinutes / 60);
    doc.text(`Duration: ${hours}h ${segment.durationMinutes % 60}m`);
    doc.moveDown(0.8);
  }

  // ---- passengers ----
  doc.fontSize(14).font('Helvetica-Bold').text('Passengers');
  doc.moveDown(0.4);
  booking.passengers.forEach((p, i) => {
    doc
      .fontSize(11)
      .font('Helvetica-Bold')
      .text(`${i + 1}. ${p.fullName} (${p.type})`);
    doc.font('Helvetica');
    doc.text(
      `   Passport/ID: ${p.passportNumber}   Date of birth: ${new Date(p.dateOfBirth).toISOString().slice(0, 10)}`,
    );
    doc.text(
      p.extraBags > 0
        ? `   Extra baggage: ${p.extraBags} bag(s), ${p.extraBagWeightKg} kg`
        : '   Extra baggage: none',
    );
  });
  doc.moveDown(0.8);

  // ---- price ----
  doc.fontSize(14).font('Helvetica-Bold').text('Payment summary');
  doc.moveDown(0.4).fontSize(11).font('Helvetica');
  const { currency } = booking.pricing;
  doc.text(`Fares: ${booking.pricing.fareTotal.toFixed(2)} ${currency}`);
  doc.text(
    `Extra baggage: ${booking.pricing.baggageTotal.toFixed(2)} ${currency}`,
  );
  doc
    .font('Helvetica-Bold')
    .text(`Total paid: ${booking.pricing.totalPrice.toFixed(2)} ${currency}`);

  doc.moveDown(2).fontSize(9).font('Helvetica').fillColor('#555555');
  doc.text(
    'Please present this e-ticket and a valid passport or ID at check-in. All times are local to each airport.',
  );
  return doc;
}
