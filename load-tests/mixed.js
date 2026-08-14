/* global __ENV */
import http from 'k6/http';
import { check, sleep } from 'k6';
export const options = {
  scenarios: {
    mixed: {
      executor: 'constant-arrival-rate',
      rate: Number(__ENV.RATE || 20),
      timeUnit: '1s',
      duration: __ENV.DURATION || '30s',
      preAllocatedVUs: 20,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<200'],
  },
};
const base = __ENV.API_URL || 'http://localhost:4000';
export default function () {
  const paths = [
    '/api/v1/places/autocomplete?q=cof',
    '/api/v1/places/nearby?lat=33.7701&lon=-118.1937&radius_m=5000',
    '/api/v1/places/search?q=coffee&lat=33.7701&lon=-118.1937&radius_m=5000',
  ];
  const r = http.get(base + paths[Math.floor(Math.random() * paths.length)]);
  check(r, { 'status 200': (x) => x.status === 200 });
  sleep(0.1);
}
