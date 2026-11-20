import { readFileSync } from 'fs';
import { join } from 'path';
import type { Model } from 'mongoose';

function readCsv(name: string): string[][] {
  const file = join(process.cwd(), 'src', 'seed', 'data', name);
  return readFileSync(file, 'utf8')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .slice(1)
    .map((l) => l.split(',').map((c) => c.trim()));
}

// GEN-12: idempotent upserts keyed on the CSV identifiers
async function upsert(
  model: Model<any>,
  key: string,
  rows: Record<string, string>[],
  label: string,
) {
  await model.bulkWrite(
    rows.map((row) => ({
      updateOne: {
        filter: { [key]: row[key] },
        update: { $set: row },
        upsert: true,
      },
    })),
  );
  console.log(`${label} upserted: ${rows.length}`);
}

export async function seedCountries(model: Model<any>) {
  const rows = readCsv('Countries.csv').map(([code, name, currency]) => ({
    code: code.toUpperCase(),
    name,
    currency: currency.toUpperCase(),
  }));
  await upsert(model, 'code', rows, 'Countries');
}

export async function seedCities(model: Model<any>) {
  const rows = readCsv('Cities.csv').map(([cityId, name, countryCode]) => ({
    cityId,
    name,
    countryCode: countryCode.toUpperCase(),
  }));
  await upsert(model, 'cityId', rows, 'Cities');
}

export async function seedAttractions(model: Model<any>) {
  const rows = readCsv('Attractions.csv').map(
    ([attractionId, name, cityId]) => ({
      attractionId,
      name,
      cityId,
    }),
  );
  await upsert(model, 'attractionId', rows, 'Attractions');
}