import { Types } from 'mongoose';
import { buildItineraryClone, CloneSource } from './itinerary-clone';

const author = new Types.ObjectId();
const me = new Types.ObjectId();

const source: CloneSource = {
  _id: new Types.ObjectId(),
  userId: author,
  title: 'Egypt trip',
  countries: ['Egypt'],
  startDate: new Date('2026-12-01'),
  days: [
    {
      dayNumber: 2,
      city: 'Luxor',
      activities: [],
      budgetEntries: [],
      transportCosts: [{ mode: 'train', fromCity: 'Cairo', toCity: 'Luxor', amount: 40, currency: 'EGP' }],
    },
    {
      dayNumber: 1,
      city: 'Cairo',
      notes: 'Pyramids',
      activities: [
        { name: 'Museum', cost: 20, currency: 'USD', images: ['/a.png'] },
        { name: 'Walk' },
      ],
      budgetEntries: [{ category: 'food', amount: 10, currency: 'EUR' }],
      transportCosts: [],
    },
  ],
};

describe('buildItineraryClone', () => {
  const clone = buildItineraryClone(source, me);

  it('belongs to the new owner, private and not hidden', () => {
    expect(clone.userId).toBe(me);
    expect(clone.visibility).toBe('private');
    expect(clone.isHidden).toBe(false);
  });

  it('credits the original author and itinerary', () => {
    expect(clone.originalAuthorId).toBe(author);
    expect(clone.originalItineraryId).toBe(source._id);
  });

  it('copies the content, days in order', () => {
    expect(clone.title).toBe('Egypt trip');
    expect(clone.days.map((d) => d.city)).toEqual(['Cairo', 'Luxor']);
    expect(clone.days[0].notes).toBe('Pyramids');
    expect(clone.days[0].activities[0]).toMatchObject({ name: 'Museum', cost: 20, currency: 'USD', images: ['/a.png'] });
    expect(clone.days[0].activities[1]).not.toHaveProperty('cost');
    expect(clone.days[0].budgetEntries[0]).toMatchObject({ category: 'food', amount: 10, currency: 'EUR' });
    expect(clone.days[1].transportCosts[0]).toMatchObject({ toCity: 'Luxor', amount: 40 });
  });

  it('gives everything a new id and does not share arrays with the source', () => {
    const originalActivity = source.days![1].activities![0];
    expect(clone.days[0].activities[0].images).not.toBe(originalActivity.images);
    const ids = clone.days.flatMap((d) => [d._id, ...d.activities.map((a) => a._id), ...d.budgetEntries.map((e) => e._id), ...d.transportCosts.map((t) => t._id)]);
    expect(new Set(ids.map(String)).size).toBe(ids.length);
  });

  it('does not copy booking links', () => {
    const withBooking = {
      ...source,
      days: [
        {
          dayNumber: 1,
          city: 'Cairo',
          budgetEntries: [{ category: 'accommodation', amount: 90, currency: 'USD', bookingId: new Types.ObjectId(), bookingType: 'hotel' }],
        },
      ],
    } as unknown as CloneSource;
    const c = buildItineraryClone(withBooking, me);
    expect(c.days[0].budgetEntries[0]).not.toHaveProperty('bookingId');
    expect(c.days[0].budgetEntries[0]).not.toHaveProperty('bookingType');
  });
});
