# k6 Performance Tests

Performance testing suite for Shiojiri Rainbow Seeker API using [k6](https://k6.io/).

## NFR-2 Requirements

This test suite verifies compliance with NFR-2 (Performance) requirements:

| Requirement | Target | Verified By |
|-------------|--------|-------------|
| API Response Time | p95 < 200ms | All test scripts |
| Concurrent Users | 1000 users | stress.js, spike.js |
| Image Upload | < 3 seconds | photos.js |
| Map Loading | < 2 seconds | map.js |

## Directory Structure

```
k6/
├── config/                 # Configuration files
│   ├── environments.json   # Environment settings
│   ├── thresholds.json     # Performance thresholds
│   └── test-data.json      # Test data
├── helpers/                # Shared utilities
│   ├── auth.js             # JWT token management
│   ├── checks.js           # Common check functions
│   └── config.js           # Environment configuration
├── scenarios/              # Test scenarios
│   ├── smoke.js            # Quick validation (10 VUs, 30s)
│   ├── load.js             # Normal load (100 VUs, 5min)
│   ├── stress.js           # Stress test (ramp to 1000 VUs)
│   └── spike.js            # Spike test (sudden 1000 VU spike)
├── scripts/                # Endpoint-specific tests
│   ├── auth.js             # Authentication endpoints
│   ├── feed.js             # Feed/gallery endpoints
│   ├── map.js              # Map endpoints
│   ├── photos.js           # Photo endpoints
│   └── social.js           # Social features
└── README.md               # This file
```

## Prerequisites

1. **Install k6**:
   ```bash
   # macOS
   brew install k6

   # Linux
   sudo apt-get install k6

   # Windows
   choco install k6
   ```

2. **Create Test Users**:
   Before running tests, create the following test users in your environment:
   - `loadtest-user@example.com` (standard user)
   - `loadtest-premium@example.com` (premium user)
   - `loadtest-admin@example.com` (admin user)

   All with password: `LoadTest123!`

## Quick Start

### 1. Smoke Test (Quick Validation)

Run this first to verify the system is working:

```bash
# Local environment
k6 run k6/scenarios/smoke.js

# Staging environment
K6_ENV=staging k6 run k6/scenarios/smoke.js
```

### 2. Load Test (Normal Load)

Test with 100 concurrent users:

```bash
k6 run k6/scenarios/load.js
```

### 3. Stress Test (Find Limits)

Ramp up to 1000 concurrent users:

```bash
k6 run k6/scenarios/stress.js
```

### 4. Spike Test (Sudden Traffic)

Test sudden traffic surge to 1000 users:

```bash
k6 run k6/scenarios/spike.js
```

## Running Individual Scripts

Test specific API endpoints:

```bash
# Authentication endpoints
k6 run k6/scripts/auth.js

# Photo endpoints
k6 run k6/scripts/photos.js

# Map endpoints
k6 run k6/scripts/map.js

# Feed/gallery endpoints
k6 run k6/scripts/feed.js

# Social features
k6 run k6/scripts/social.js
```

## Environment Configuration

Set the environment using `K6_ENV`:

```bash
# Local (default)
k6 run k6/scenarios/load.js

# Staging
K6_ENV=staging k6 run k6/scenarios/load.js

# Production (use with caution!)
K6_ENV=production k6 run k6/scenarios/load.js
```

## Output Options

### Console Output

```bash
k6 run k6/scenarios/load.js
```

### JSON Output

```bash
k6 run --out json=results.json k6/scenarios/load.js
```

### InfluxDB + Grafana

```bash
k6 run --out influxdb=http://localhost:8086/k6 k6/scenarios/load.js
```

### CSV Output

```bash
k6 run --out csv=results.csv k6/scenarios/load.js
```

## Test Scenarios Explained

### Smoke Test (`smoke.js`)

- **Purpose**: Quick validation that system is functioning
- **VUs**: 10
- **Duration**: ~40 seconds
- **Use Case**: Run before deployments or larger tests

### Load Test (`load.js`)

- **Purpose**: Verify NFR-2 compliance under normal load
- **VUs**: 100 (ramped)
- **Duration**: ~7 minutes
- **Use Case**: Regular performance validation

### Stress Test (`stress.js`)

- **Purpose**: Find breaking points and performance limits
- **VUs**: Ramps from 0 to 1000
- **Duration**: ~18 minutes
- **Use Case**: Capacity planning, identifying bottlenecks

### Spike Test (`spike.js`)

- **Purpose**: Test resilience to sudden traffic surges
- **VUs**: Sudden spike to 1000
- **Duration**: ~7 minutes
- **Use Case**: Testing auto-scaling, graceful degradation

## Performance Thresholds

Default thresholds based on NFR-2:

```javascript
thresholds: {
  // API response time
  http_req_duration: ['p(95)<200', 'p(99)<500', 'avg<100'],

  // Error rate
  http_req_failed: ['rate<0.01'],

  // Throughput
  http_reqs: ['rate>100'],
}
```

## Custom Metrics

The tests track custom metrics:

- `*_success`: Success rate for specific operations
- `*_duration`: Response time trends
- `nfr2_compliance`: Percentage meeting p95 < 200ms
- `error_rate`: Overall error rate

## Interpreting Results

### Key Metrics to Watch

| Metric | Description | NFR-2 Target |
|--------|-------------|--------------|
| `http_req_duration p(95)` | 95th percentile response time | < 200ms |
| `http_req_failed` | Request failure rate | < 1% |
| `http_reqs` | Requests per second | > 100/s |
| `vus` | Active virtual users | Up to 1000 |

### Example Output

```
     checks.........................: 98.50% 9850 out of 10000
     data_received..................: 150 MB 2.5 MB/s
     data_sent......................: 25 MB  417 kB/s
     http_req_blocked...............: avg=1.2ms  p(95)=5ms
     http_req_duration..............: avg=45ms   p(95)=150ms   ✓ NFR-2 PASS
     http_req_failed................: 0.50%  50 out of 10000  ✓ NFR-2 PASS
     http_reqs......................: 10000  166.67/s
```

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Ensure test users exist in the target environment
   - Check API base URL is correct

2. **High Error Rates**
   - Check server logs for errors
   - Verify database connections
   - Check for rate limiting

3. **Slow Response Times**
   - Check database query performance
   - Verify caching is working
   - Check for N+1 query problems

### Debug Mode

Enable verbose logging:

```bash
k6 run --verbose k6/scenarios/smoke.js
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Performance Tests
on:
  schedule:
    - cron: '0 2 * * *'  # Daily at 2 AM
  workflow_dispatch:

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install k6
        run: |
          sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Run Smoke Test
        run: k6 run k6/scenarios/smoke.js
        env:
          K6_ENV: staging

      - name: Run Load Test
        run: k6 run k6/scenarios/load.js
        env:
          K6_ENV: staging
```

## Best Practices

1. **Always run smoke test first** before larger tests
2. **Use staging environment** for regular testing
3. **Be cautious with production** - coordinate with ops team
4. **Monitor server resources** during stress/spike tests
5. **Clean up test data** after running tests
6. **Store results** for trend analysis

## Contributing

When adding new tests:

1. Follow existing patterns in helper modules
2. Include appropriate thresholds
3. Add custom metrics for tracking
4. Update this README
5. Test locally before committing

## License

See main project LICENSE file.
