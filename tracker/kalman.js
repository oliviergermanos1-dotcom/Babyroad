// ── Filtre Kalman 1D appliqué à lat/lng — lisse les sauts GPS
// Implémentation simple variance-based (constante de processus Q).
export class GPSKalmanFilter {
  constructor(processNoise = 3) {
    this.Q = processNoise; // m/s — dynamique attendue du véhicule
    this.lat = null;
    this.lng = null;
    this.variance = -1;
    this.timestamp = 0;
  }

  // accuracy en mètres, timestamp en ms
  filter(lat, lng, accuracy, timestamp = Date.now()) {
    const acc = Math.max(accuracy, 1);
    if (this.variance < 0) {
      // première mesure
      this.lat = lat;
      this.lng = lng;
      this.variance = acc * acc;
      this.timestamp = timestamp;
      return { lat, lng };
    }

    const dtS = (timestamp - this.timestamp) / 1000;
    if (dtS > 0) {
      this.variance += dtS * this.Q * this.Q;
      this.timestamp = timestamp;
    }

    // gain de Kalman
    const K = this.variance / (this.variance + acc * acc);
    this.lat += K * (lat - this.lat);
    this.lng += K * (lng - this.lng);
    this.variance = (1 - K) * this.variance;

    return { lat: this.lat, lng: this.lng };
  }

  reset() {
    this.variance = -1;
    this.lat = null;
    this.lng = null;
  }
}
