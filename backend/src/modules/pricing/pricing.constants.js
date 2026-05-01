/** Canonical vehicle category labels (must match driver / walk-up flows). */
const VEHICLE_GROUPS = [
  {
    group: "Public Transport",
    items: [
      "Public Transport Vehicles | Upto 12 Seats",
      "Public Transport Vehicles | 13-24 Seats",
      "Public Transport Vehicles | 25 Seats and above",
    ],
  },
  {
    group: "Two Wheelers",
    items: ["Bicycle | Bicycle", "Motorcycle | Motorcycle"],
  },
  {
    group: "Dry Freight",
    items: [
      "Dry Freight Vehicles | <35 Quintal",
      "Dry Freight Vehicles | 36-70 Quintal",
      "Dry Freight Vehicles | >71 Quintal",
    ],
  },
  {
    group: "Liquid Cargo",
    items: [
      "Liquid Cargo Vehicles | Upto 28 Liter",
      "Liquid Cargo Vehicles | Above 28 Liter",
    ],
  },
  {
    group: "Machineries",
    items: [
      "Machineries | Upto 5000KG weight",
      "Machineries | 5001-10,000KG weight",
      "Machineries | Above 10,001KG weight",
    ],
  },
];

const ALL_VEHICLE_CATEGORIES = VEHICLE_GROUPS.flatMap((g) => g.items);

const DEFAULT_HOURLY_RATE_ETB = 15;

const ALLOWED_CATEGORY_SET = new Set(ALL_VEHICLE_CATEGORIES);

module.exports = {
  VEHICLE_GROUPS,
  ALL_VEHICLE_CATEGORIES,
  DEFAULT_HOURLY_RATE_ETB,
  ALLOWED_CATEGORY_SET,
};
