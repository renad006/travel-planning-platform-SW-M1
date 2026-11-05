import { readFileSync } from 'fs';
import { join } from 'path';
import type { Model } from 'mongoose';
import { AirportDocument } from '../reference-data/schemas/airport.schema';

// GEN-12: idempotent, upsert keyed on iata_code so identifiers are preserved
export async function seedAirports(model: Model<AirportDocument>) {
  const file = join(process.cwd(), 'src', 'seed', 'data', 'Airports.csv');
  const lines = readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim());

  const rows = lines.slice(1).map((line) => {
    const [iataCode, name, cityId, countryCode, timeZone] = line
      .split(',')
      .map((cell) => cell.trim());
    return {
      iataCode: iataCode.toUpperCase(),
      name,
      cityId,
      countryCode: countryCode.toUpperCase(),
      timeZone,
    };
  });

  await model.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { iataCode: row.iataCode },
        update: { $set: row },
        upsert: true,
      },
    })),
  );
  console.log(`Airports upserted: ${rows.length}`);
}