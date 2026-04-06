/**
 * FlightRank — Data Fetcher
 * הרץ פעם בחודש: node fetch_flights.js
 * מייצר flights.json — העלה אותו ל-GitHub יחד עם index.html
 */

const https = require('https');
const fs    = require('fs');

const SERP_KEY = '1b02bc7ff0a0b50aba07140b414109a5231c0ef97e1052d767b56960d73cac61';

const ROUTES = [
  ['TLV','LHR'], ['LHR','TLV'],
  ['JFK','LHR'], ['LHR','JFK'],
  ['DXB','SIN'], ['SIN','DXB'],
  ['DXB','BKK'], ['BKK','DXB'],
];

const WEEKS_AHEAD = 26;

// תאריך רנדומלי בתוך כל שבוע → אין הטיה ליום ספציפי
function generateDates() {
  const dates = [];
  const today = new Date();
  for (let week = 1; week <= WEEKS_AHEAD; week++) {
    const randomDayOffset = Math.floor(Math.random() * 7);
    const date = new Date(today);
    date.setDate(today.getDate() + week * 7 + randomDayOffset);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

function fetchRoute(from, to, date) {
  return new Promise((resolve, reject) => {
    const url =
      `https://serpapi.com/search.json?engine=google_flights` +
      `&departure_id=${from}&arrival_id=${to}` +
      `&outbound_date=${date}&currency=USD&hl=en&type=2` +
      `&api_key=${SERP_KEY}`;

    https.get(url, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(raw);
          if (json.error) { reject(new Error(json.error)); return; }

          const flights = [
            ...(json.best_flights  || []),
            ...(json.other_flights || []),
          ].map((f, i) => {
            const first = f.flights[0];
            const last  = f.flights[f.flights.length - 1];
            return {
              id:            `${from}-${to}-${date}-${i}`,
              from, to, date,
              airlineName:   first.airline || '',
              airlineLogo:   first.airline_logo || '',
              flightNumber:  first.flight_number || '',
              stops:         f.flights.length - 1,
              price:         f.price,
              duration:      f.total_duration,
              departureTime: first.departure_airport?.time || '',
              arrivalTime:   last.arrival_airport?.time   || '',
            };
          }).filter(f => f.price > 0 && f.duration > 0);

          resolve(flights);
        } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('✈  FlightRank Data Fetcher');
  const dates  = generateDates();
  const total  = dates.length * ROUTES.length;
  console.log(`📅 ${dates.length} dates × ${ROUTES.length} routes = ${total} queries\n`);

  const allFlights = [];
  let count = 0, failed = 0;

  for (const date of dates) {
    for (const [from, to] of ROUTES) {
      count++;
      process.stdout.write(`\r[${count}/${total}] ${from}→${to}  ${date} ...`);
      try {
        const flights = await fetchRoute(from, to, date);
        allFlights.push(...flights);
        await sleep(400); // rate-limit עדין
      } catch (e) {
        failed++;
        process.stdout.write(` ❌ ${e.message}\n`);
      }
    }
  }

  const output = {
    fetched_at:  new Date().toISOString(),
    total_flights: allFlights.length,
    dates,
    routes: ROUTES.map(([f,t]) => `${f}-${t}`),
    flights: allFlights,
  };

  fs.writeFileSync('flights.json', JSON.stringify(output));
  console.log(`\n\n✅  ${allFlights.length} טיסות נשמרו ל-flights.json`);
  if (failed > 0) console.log(`⚠   ${failed} שאילתות נכשלו`);
  console.log('\n➡  עכשיו העלה flights.json ו-index.html ל-GitHub');
}

main();
