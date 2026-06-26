import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';

import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';

import { resourceFromAttributes } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';

const serviceName = process.env.OTEL_SERVICE_NAME || 'workway-backend';
const collectorUrl =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4321';

const resource = resourceFromAttributes({
  [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
  [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]:
    process.env.NODE_ENV || 'development',
});

const traceExporter = new OTLPTraceExporter({
  url: `${collectorUrl}/v1/traces`,
});

const metricExporter = new OTLPMetricExporter({
  url: `${collectorUrl}/v1/metrics`,
});

const logExporter = new OTLPLogExporter({
  url: `${collectorUrl}/v1/logs`,
});

const metricReader = new PeriodicExportingMetricReader({
  exporter: metricExporter,
  exportIntervalMillis: 10000,
});

const logRecordProcessor = new BatchLogRecordProcessor(logExporter);

const sdk = new NodeSDK({
  resource,
  traceExporter,
  metricReader,
  logRecordProcessor,
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-http': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-express': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-pg': {
        enabled: true,
      },
      '@opentelemetry/instrumentation-fs': {
        enabled: false,
      },
    }),
  ],
});

try {
  await sdk.start();
  console.log('OpenTelemetry started');
} catch (err) {
  console.error('Tracing init failed:', err);
}

const shutdown = async () => {
  try {
    await sdk.shutdown();
    console.log('Tracing shut down');
  } catch (err) {
    console.error('Error shutting down tracing:', err);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

export default sdk;