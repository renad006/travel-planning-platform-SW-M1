import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Option } from "../places";
import { outlineButton, redButton, surface } from "../styles";
import type { HotelSearchQuery } from "../types";

// Placeholder field styling until the shared FormField (Member 1) is merged.
const label = "flex flex-col gap-1.5 text-xs font-medium text-brand-navy/70";
const field =
  "h-11 w-full rounded-xl border border-input bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40";

export function Input({ text, ...props }: { text: string } & React.ComponentProps<"input">) {
  return (
    <label className={label}>
      {text}
      <input {...props} className={field} />
    </label>
  );
}

export function Select({ text, options, ...props }: { text: string; options: Option[] } & React.ComponentProps<"select">) {
  return (
    <label className={label}>
      {text}
      <select {...props} className={field}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

const FORM_ID = "hotel-search";
const any = (text: string) => ({ value: "", label: text });

// On laptops the fields lose their boxes and sit side by side, separated by lines.
const searchBar = [
  "grid grid-cols-2 items-end gap-3 p-5",
  "lg:grid-cols-[repeat(4,minmax(0,1fr))_repeat(2,5.5rem)_auto] lg:items-center lg:gap-0 lg:rounded-full lg:py-3 lg:pr-3 lg:pl-4",
  "lg:[&>label]:border-r lg:[&>label]:px-4 lg:[&>label]:text-brand-navy lg:[&>label]:font-semibold",
  "lg:[&_input]:h-7 lg:[&_input]:border-0 lg:[&_input]:bg-transparent lg:[&_input]:px-0",
  "lg:[&_select]:h-7 lg:[&_select]:border-0 lg:[&_select]:bg-transparent lg:[&_select]:px-0",
].join(" ");

/** A plain GET form: the whole search lives in the URL and works without client JavaScript. */
export function HotelSearchForm({
  query,
  cities,
  countries,
}: {
  query: HotelSearchQuery;
  cities: Option[];
  countries: Option[];
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    // key: reset the fields when the URL changes
    <form
      key={JSON.stringify(query)}
      id={FORM_ID}
      action="/hotels"
      className={`${surface} ${searchBar}`}
    >
      <Select text="City" name="cityId" defaultValue={query.cityId} options={[any("Any city"), ...cities]} />
      <Select
        text="Country"
        name="countryCode"
        defaultValue={query.countryCode}
        options={[any("Any country"), ...countries]}
      />
      <Input text="Check-in" type="date" name="checkIn" required min={today} defaultValue={query.checkIn} />
      <Input text="Check-out" type="date" name="checkOut" required min={today} defaultValue={query.checkOut} />
      <Input text="Guests" type="number" name="guests" required min={1} defaultValue={query.guests ?? "2"} />
      <Input text="Rooms" type="number" name="rooms" required min={1} defaultValue={query.rooms ?? "1"} />
      <Button type="submit" size="lg" className={`col-span-2 h-11 lg:col-span-1 lg:ml-3 lg:size-12 ${redButton}`}>
        <span className="lg:sr-only">Search</span>
        <ArrowRight aria-hidden className="hidden size-5 lg:block" />
      </Button>
    </form>
  );
}

/** Sidebar filters and sorting. The fields belong to the search form above through their form attribute. */
export function HotelFilters({ query }: { query: HotelSearchQuery }) {
  const price = { type: "number", min: 0, step: "any", form: FORM_ID };

  return (
    <aside
      key={JSON.stringify(query)}
      aria-label="Filters and sorting"
      className={`grid grid-cols-2 gap-3 p-5 lg:sticky lg:top-4 ${surface}`}
    >
      <h2 className="col-span-2 border-b pb-3 text-sm font-semibold">Filters and sorting</h2>
      <Input {...price} text="Min price" name="minPrice" placeholder="Any" defaultValue={query.minPrice} />
      <Input {...price} text="Max price" name="maxPrice" placeholder="Any" defaultValue={query.maxPrice} />
      <div className="col-span-2 grid gap-3">
        <Select
          text="Rating"
          name="minRating"
          form={FORM_ID}
          defaultValue={query.minRating}
          options={[any("Any rating"), ...["1", "2", "3", "4", "5"].map((v) => ({ value: v, label: `${v} and up` }))]}
        />
        <Select
          text="Sort by"
          name="sortBy"
          form={FORM_ID}
          defaultValue={query.sortBy}
          options={[any("Name"), { value: "price", label: "Price" }, { value: "rating", label: "Rating" }]}
        />
        <Select
          text="Price / rating order"
          name="sortOrder"
          form={FORM_ID}
          defaultValue={query.sortOrder}
          options={[
            { value: "asc", label: "Low to high" },
            { value: "desc", label: "High to low" },
          ]}
        />
        <Button type="submit" form={FORM_ID} size="lg" className={`h-11 ${outlineButton}`}>
          Apply filters
        </Button>
      </div>
    </aside>
  );
}
